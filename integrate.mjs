#!/usr/bin/env node
/**
 * Integrated entry point
 * readiness → orchestration → LaunchDesk → procurement decision
 * Optional doctor gate when gateDoctorOnProcure or GATE_DOCTOR=1
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitReadinessEvidence } from './lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from './agents/orchestration.mjs';
import { handleLaunchDeskAction } from './launchdesk/actions.mjs';
import { recordDecision } from './status/decision-log.mjs';
import { readPlaneState, pausePlane, resumePlane } from './status/plane-state.mjs';
import { writeStatusFile } from './status/write-status-file.mjs';
import { loadConfig } from './lib/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const action = process.argv[2] || 'status';
const goal = process.argv[3] || 'integrated-check';
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const gateDoctor =
  process.env.GATE_DOCTOR === '1' ||
  process.env.GATE_DOCTOR === 'true' ||
  config.gateDoctorOnProcure === true;

if (action === 'pause') {
  const state = pausePlane(goal || 'operator-pause');
  const result = {
    timestamp: new Date().toISOString(),
    action: 'pause',
    decision: 'PAUSED',
    state,
    dryRun,
    note: 'Plane paused. Further procure decisions will be held.',
    securityValue: config.securityValue
  };
  if (!dryRun) {
    try { recordDecision({ decision: 'PAUSED', action: 'pause', goal }); } catch {}
    try { writeStatusFile({ source: 'integrate', ...result }); } catch {}
  }
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
    dryRun,
    note: 'Plane resumed.',
    securityValue: config.securityValue
  };
  if (!dryRun) {
    try { recordDecision({ decision: 'RESUMED', action: 'resume', goal }); } catch {}
    try { writeStatusFile({ source: 'integrate', ...result }); } catch {}
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

let doctorPassed = null;
if (gateDoctor && (action === 'procure' || action === 'status')) {
  const doctor = spawnSync(process.execPath, [join(__dirname, 'status/doctor.mjs')], {
    cwd: __dirname,
    encoding: 'utf8'
  });
  doctorPassed = doctor.status === 0;
  if (!doctorPassed && action === 'procure') {
    const result = {
      timestamp: new Date().toISOString(),
      action,
      goal,
      decision: 'HOLD_DOCTOR',
      dryRun,
      doctorPassed: false,
      note: 'Doctor gate failed. Fix doctor checks before procure, or disable gateDoctorOnProcure / GATE_DOCTOR.',
      securityValue: config.securityValue
    };
    if (!dryRun) {
      try {
        recordDecision({
          decision: result.decision,
          action,
          goal,
          doctorPassed: false
        });
      } catch {}
      try { writeStatusFile({ source: 'integrate', ...result }); } catch {}
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

const planeState = readPlaneState();
const readiness = emitReadinessEvidence({ source: 'integrate-entry' });
const plan = evaluateQuorum(createOrchestrationPlan(goal));
const launchdesk = handleLaunchDeskAction(action, goal);

const localEvidenceAuthority =
  process.env.ACCEPT_LOCAL_EVIDENCE === '1' ||
  process.env.ACCEPT_LOCAL_EVIDENCE === 'true' ||
  config.acceptLocalEvidenceByDefault === true;

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
  dryRun,
  doctorGated: gateDoctor,
  doctorPassed,
  paused: planeState.paused,
  pauseReason: planeState.reason,
  readiness: {
    overall: readiness.overallDecision,
    provider: readiness.provider,
    failedGates: readiness.failedGates,
    securityValue: readiness.securityValue || config.securityValue
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
    dryRun
      ? 'Dry run — decision not recorded and status file not updated.'
      : decision === 'PAUSED'
        ? `Plane is paused (${planeState.reason || 'no reason'}). Use: npm run resume`
        : decision === 'READY_FOR_PROCUREMENT'
          ? 'Integrated check passed. Local evidence accepted.'
          : decision === 'READY_LOCAL_HOLD_PUBLIC_EVIDENCE'
            ? 'Core systems READY. Public evidence-console still required or set ACCEPT_LOCAL_EVIDENCE=1.'
            : 'Core readiness or orchestration not yet READY.',
  securityValue: config.securityValue
};

if (!dryRun) {
  try {
    recordDecision({
      decision: result.decision,
      action: result.action,
      goal: result.goal,
      readinessOverall: result.readiness.overall,
      orchestrationOverall: result.orchestration.overall,
      localEvidenceAccepted: result.localEvidenceAccepted,
      paused: result.paused,
      doctorPassed: result.doctorPassed
    });
  } catch (err) {
    result.logError = String(err.message || err);
  }

  try {
    writeStatusFile({ source: 'integrate', ...result });
  } catch (err) {
    result.statusFileError = String(err.message || err);
  }
}

console.log(JSON.stringify(result, null, 2));
