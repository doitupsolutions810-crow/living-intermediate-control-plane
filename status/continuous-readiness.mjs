#!/usr/bin/env node
/**
 * Continuous readiness service stub
 * Emits the deterministic-local-evidence schema on an interval.
 * Can later be turned into a long-running process or edge function.
 *
 * Control704 high-priority override surface
 */

import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';

const INTERVAL_MS = Number(process.env.READINESS_INTERVAL_MS) || 30000;

function tick() {
  const evidence = emitReadinessEvidence({
    source: 'continuous-readiness-stub',
    intervalMs: INTERVAL_MS
  });
  console.log(JSON.stringify(evidence));
}

console.error(`[continuous-readiness] starting — interval ${INTERVAL_MS}ms`);
tick();
setInterval(tick, INTERVAL_MS);
