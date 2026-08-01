#!/usr/bin/env node
/**
 * Continuous readiness service stub
 * Emits deterministic-local-evidence on an interval,
 * respects plane pause state, and updates the live status file.
 *
 * Control704 high-priority override surface
 */

import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { readPlaneState } from './plane-state.mjs';
import { writeStatusFile } from './write-status-file.mjs';

const INTERVAL_MS = Number(process.env.READINESS_INTERVAL_MS) || 30000;

function tick() {
  const planeState = readPlaneState();
  const evidence = emitReadinessEvidence({
    source: 'continuous-readiness',
    intervalMs: INTERVAL_MS
  });

  const status = {
    source: 'continuous-readiness',
    paused: planeState.paused,
    pauseReason: planeState.reason,
    readiness: evidence,
    overall: planeState.paused ? 'PAUSED' : evidence.overallDecision
  };

  writeStatusFile(status);
  console.log(JSON.stringify(status));
}

console.error(`[continuous-readiness] starting — interval ${INTERVAL_MS}ms`);
tick();
setInterval(tick, INTERVAL_MS);
