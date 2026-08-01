#!/usr/bin/env node
/**
 * Health check — exits 0 when the plane is in an acceptable state,
 * non-zero otherwise. Useful for scripts and simple monitoring.
 *
 * Acceptable = not paused AND readiness READY AND orchestration READY
 *
 * Control704 high-priority override surface
 */

import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { readPlaneState } from './plane-state.mjs';

const planeState = readPlaneState();
const readiness = emitReadinessEvidence({ source: 'health-check' });
const plan = evaluateQuorum(createOrchestrationPlan('health-check'));

const healthy =
  !planeState.paused &&
  readiness.overallDecision === 'READY' &&
  readiness.failedGates.length === 0 &&
  plan.overallDecision === 'READY';

const result = {
  timestamp: new Date().toISOString(),
  healthy,
  paused: planeState.paused,
  readiness: readiness.overallDecision,
  orchestration: plan.overallDecision,
  failedGates: [
    ...(readiness.failedGates || []),
    ...(plan.failedGates || [])
  ],
  securityValue: 'High'
};

console.log(JSON.stringify(result, null, 2));
process.exit(healthy ? 0 : 1);
