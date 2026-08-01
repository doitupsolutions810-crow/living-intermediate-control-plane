#!/usr/bin/env node
/**
 * Living Intermediate Control Plane — integrated entry point
 *
 * Runs readiness → orchestration → LaunchDesk → procurement decision,
 * respects pause state, and records the result.
 *
 * Usage:
 *   node integrate.mjs
 *   node integrate.mjs status
 *   ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs procure
 *
 * Control704 high-priority override surface
 */

import { emitReadinessEvidence } from './lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from './agents/orchestration.mjs';
import { handleLaunchDeskAction } from './launchdesk/actions.mjs';
import { recordDecision } from './status/decision-log.mjs';
import { readPlaneState, pausePlane, resumePlane } from './status/plane-state.mjs';

const action = process.argv[2] || 'status';
const goal = process.argv[3] || 'integrated-check';

// Handle pause / resume as control actions before the normal path
if (action === 'pause') {
  const state = pausePlane(goal || 'operator-pause');
  const result = {
    timestamp: new Date().toISOString(),
    action: 'pause',
    decision: 'PAUSED',
    state,
    note: 'Plane paused under Control704 override. Further procure decisions will be held.',
    securityValue: 'High'
  };
  try { recordDecision({ decision: 'PAUSED', action: 'pause', goal }); } catch {}
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (action === 'resume') {
  const state = resumePlane();
  const result = {
    timestamp: new Date().toISOString(),
    action: 'resume',
    decision: 'RESUMED',
    state,
    note: 'Plane resumed under Control704 override.',
    securityValue: 'High'
  };
  try { recordDecision({ decision: 'RESUMED', action: 'resume', goal }); } catch {}
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const planeState = readPlaneState();
const readiness = emitReadinessEvidence({ source: 'integrate-entry' });
const plan = evaluateQuorum(createOrchestrationPlan(goal));
const launchdesk = handleLaunchDeskAction(action, goal);

const localEvidenceAuthority = process.env.ACCEPT_LOCAL_EVIDENCE === '1' || process.env.ACCEPT_LOCAL_EVIDENCE === 'true';
const force = process.env.FORCE_PROCUREMENT === '1';

const coreReady =
  readiness.overallDecision === 'READY' &&
  readiness.failedGates.length === 0 &&
  plan.overallDecision === 'READY';

let decision;
if (planeState.paused) {
  decision = 'PAUSED';
} else if (coreReady && (localEvidenceAuthority || force)) {
  decision = 'READY_FOR_PROCUREMENT';
} else if (coreReady) {
  decision = 'READY_LOCAL_HOLD_PUBLIC_EVIDENCE';
} else {
  decision = 'HOLD';
}

const result = {
  timestamp: new Date().toISOString(),
  action,
  goal,
  decision,
  paused: planeState.paused,
  pauseReason: planeState.reason,
  readiness: {
    overall: readiness.overallDecision,
    provider: readiness.provider,
    failedGates: readiness.failedGates,
    securityValue: readiness.securityValue
  },
  orchestration: {
    overall: plan.overallDecision,
    rolesReady: plan.roles.filter(r => r.status === 'READY').length,
    totalRoles: plan.roles.length,
    failedGates: plan.failedGates
  },
  launchdesk: {
    accepted: launchdesk.accepted,
    decision: launchdesk.decision,
    knownAction: launchdesk.knownAction
  },
  localEvidenceAccepted: localEvidenceAuthority,
  note:
    decision === 'PAUSED'
      ? `Plane is paused (${planeState.reason || 'no reason'}). Use: node integrate.mjs resume`
      : decision === 'READY_FOR_PROCUREMENT'
        ? 'Integrated check passed. Local plane accepted as temporary evidence authority under Control704 override.'
        : decision === 'READY_LOCAL_HOLD_PUBLIC_EVIDENCE'
          ? 'Core systems READY. Public evidence-console domain still required or set ACCEPT_LOCAL_EVIDENCE=1.'
          : 'Core readiness or orchestration not yet READY.',
  securityValue: 'High'
};

try {
  recordDecision({
    decision: result.decision,
    action: result.action,
    goal: result.goal,
    readinessOverall: result.readiness.overall,
    orchestrationOverall: result.orchestration.overall,
    localEvidenceAccepted: result.localEvidenceAccepted,
    paused: result.paused
  });
} catch (err) {
  result.logError = String(err.message || err);
}

console.log(JSON.stringify(result, null, 2));
