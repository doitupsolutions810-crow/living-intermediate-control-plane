#!/usr/bin/env node
/**
 * Living Intermediate Control Plane — integrated entry point
 *
 * Runs readiness → orchestration → procurement decision in one pass.
 * Optional LaunchDesk action can be supplied as the first argument.
 *
 * Usage:
 *   node integrate.mjs
 *   node integrate.mjs status
 *   ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs evolve
 *
 * Control704 high-priority override surface
 */

import { emitReadinessEvidence } from './lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from './agents/orchestration.mjs';
import { handleLaunchDeskAction } from './launchdesk/actions.mjs';

const action = process.argv[2] || 'status';
const goal = process.argv[3] || 'integrated-check';

const readiness = emitReadinessEvidence({ source: 'integrate-entry' });
const plan = evaluateQuorum(createOrchestrationPlan(goal));
const launchdesk = handleLaunchDeskAction(action, goal);

const localEvidenceAuthority = process.env.ACCEPT_LOCAL_EVIDENCE === '1' || process.env.ACCEPT_LOCAL_EVIDENCE === 'true';
const force = process.env.FORCE_PROCUREMENT === '1';

const coreReady =
  readiness.overallDecision === 'READY' &&
  readiness.failedGates.length === 0 &&
  plan.overallDecision === 'READY';

const decision =
  coreReady && (localEvidenceAuthority || force)
    ? 'READY_FOR_PROCUREMENT'
    : coreReady
      ? 'READY_LOCAL_HOLD_PUBLIC_EVIDENCE'
      : 'HOLD';

const result = {
  timestamp: new Date().toISOString(),
  action,
  goal,
  decision,
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
    decision: launchdesk.decision
  },
  localEvidenceAccepted: localEvidenceAuthority,
  note:
    decision === 'READY_FOR_PROCUREMENT'
      ? 'Integrated check passed. Local plane accepted as temporary evidence authority under Control704 override.'
      : decision === 'READY_LOCAL_HOLD_PUBLIC_EVIDENCE'
        ? 'Core systems READY. Public evidence-console domain still required or set ACCEPT_LOCAL_EVIDENCE=1.'
        : 'Core readiness or orchestration not yet READY.',
  securityValue: 'High'
};

console.log(JSON.stringify(result, null, 2));
