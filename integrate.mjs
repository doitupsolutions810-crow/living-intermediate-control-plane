#!/usr/bin/env node
/**
 * Integrated entry point
 * readiness → orchestration → LaunchDesk → procurement decision
 * Optional doctor gate when gateDoctorOnProcure or GATE_DOCTOR=1
 * Evidence-console: graceful when public domain 404s / unreachable
 *
 * GSLI: residual coordinate + independent E/G gate namespaces
 * emergent-compile: residual fetched live from Avrone great_scale endpoint;
 * unmeasured residual => HOLD (never READY_FOR_PROCUREMENT)
 */

import { spawnSync } from 'node:child_process';
import {dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitReadinessEvidence } from './lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from './agents/orchestration.mjs';
import { handleLaunchDeskAction } from './launchdesk/actions.mjs';
import { recordDecision } from './status/decision-log.mjs';
import { readPlaneState, pausePlane, resumePlane } from './status/plane-state.mjs';
import { writeStatusFile } from './status/write-status-file.mjs';
import { loadConfig } from './lib/config.mjs';
import { probeEvidenceConsole } from './lib/evidence-console.mjs';
import { acceptsLocalEvidence } from './lib/evidence-authorization.mjs';
import { evaluateGateNamespaces } from './lib/gate-namespaces.mjs';
import { residualSnapshot } from './lib/great-scale-residual.mjs';

const __dirname =dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const action = process.argv[2] || 'status';
const goal = process.argv[3] || 'integrated-check';
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const gateDoctor=
  process.env.GATE_DOCTOR === '1' ||
  process.env.GATE_DOCTOR === 'true' ||
  config.gateDoctorOnProcure === true;

if (action === 'pause') {
  const state = pausePlane(goal || 'operator-pause);
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
const evidenceConsole = await probeEvidenceConsole({ acceptLocal: true });

// Availability fallback is diagnostic only; authorization is a separate policy.
// FORCE_PROCUREMENT is never an authorization input (Great Scale invariant).
const localEvidenceAuthority = acceptsLocalEvidence({ env: process.env, config });

const coreReady=
  readiness.overallDecision === 'READY' &&
  readiness.failedGates.length === 0 &&
  plan.overallDecision === 'READY';

// emergent-compile Wire 2: residual fetched LIVE from Avrone great_scale endpoint.
// Unmeasured (null) residual is treated as HOLD by gate-namespaces — never READY.
let residualS = null;
let residualSource = 'unmeasured';
try {
  const gsUrl = process.env.GREAT_SCALE_URL || config.greatScaleUrl || 'http://avrone:8787/greatscale/residual';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl Abort(), 3000);
  const res = await fetch(gsUrl, { signal: ctrl.signal });
  clearTimeout(timer);
  if (res.ok) {
    const body = await res.json();
    if (body && typeof body.S === 'number') {
      residualS = body.S;
      residualSource = 'live';
    }
  }
} catch {
  // fetch failed — residual stays unmeasured
}
if (residualS === null) {
  // env override still allowed for operators, but flagged
  const envS = Number(process.env.GREAT_SCALE_S);
  if (Number.isFinite(envS)) {
    residualS = envS;
    residualSource = 'env-override';
  }
}

const gates = evaluateGateNamespaces({
  coreReady,
  evidenceConsole,
  env: process.env,
  config,
  S: residualS,
  supplyChainOk: false, // production requires explicit supply-chain path; not assumed
  requireCone: true,
});

let decision;
if (planeState.paused) {
  decision = 'PAUSED';
} else if (residualS === null) {
  // emergent-compile: unmeasured residual cannot authorize procurement
  decision = 'HOLD_UNMEASURED_RESIDUAL';
} else if (gates.procurement.procurementReady) {
  decision = 'READY_FOR_PROCUREMENT';
} else if (coreReady && !gates.procurement.evidenceAuthorized) {
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
  evidenceConsole: {
    status: evidenceConsole.status,
    httpStatus: evidenceConsole.httpStatus,
    authority: evidenceConsole.authority,
    url: evidenceConsole.url,
    note: evidenceConsole.note
  },
  localEvidenceAccepted: localEvidenceAuthority,
  residual: { ...gates.residual, S: residualS, source: residualSource },
  gateNamespaces: {
    procurement: gates.procurement,
    production: gates.production,
    invariant: gates.invariant,
  },
  note:
    dryRun
      ? 'Dry run — decision not recorded and status file not updated.'
      : decision === 'PAUSED'
        ? `Plane is paused (${planeState.reason || 'no reason'}). Use: npm run resume`
        : decision === 'HOLD_UNMEASURED_RESIDUAL'
          ? 'Residual unmeasured. Procurement held per emergent-compile invariant: unmeasured cannot attest.'
          : decision === 'READY_FOR_PROCUREMENT'
            ? evidenceConsole.status === 'ok'
              ? 'Integrated check passed. Public evidence-console healthy.'
              : 'Integrated check passed. Local evidence accepted (public console gracefully deferred).'
            : decision === 'READY_LOCAL_HOLD_PUBLIC_EVIDENCE'
              ? 'Core systems READY. Public evidence-console still required or set ACCEPT_LOCAL_EVIDENCE=1.'
              : 'Core readiness or orchestration not yet READY.',
  securityValue: config.securityValue
;

if (!dryRun) {
  try {
    recordDecision({
      decision: result.decision,
      action: result.action,
      goal: result.goal,
      readinessOverall: result.readiness.overall,
      orchestrationOverall: result.orchestration.overall,
      localEvidenceAccepted: result.localEvidenceAccepted,
      evidenceConsoleStatus: result.evidenceConsole.status,
      paused: result.paused,
      doctorPassed: result.doctorPassed,
      residualS: residualS,
      residualSource: residualSource
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
