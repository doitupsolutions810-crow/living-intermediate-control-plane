#!/usr/bin/env node
/**
 * Next-steps advisor — recommends what to run based on current plane state
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlaneState } from './plane-state.mjs';
import { readRecentDecisions } from './decision-log.mjs';
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const planeState = readPlaneState();
const readiness = emitReadinessEvidence({ source: 'next-advisor' });
const plan = evaluateQuorum(createOrchestrationPlan('next-advisor'));
const recent = readRecentDecisions(5);

const statusPath = join(root, 'data', 'status.json');
let live = null;
if (existsSync(statusPath)) {
  try { live = JSON.parse(readFileSync(statusPath, 'utf8')); } catch {}
}

const recommendations = [];

if (planeState.paused) {
  recommendations.push({
    priority: 1,
    command: 'npm run resume',
    reason: 'Plane is paused; clear the hold before procuring.'
  });
}

if (readiness.overallDecision !== 'READY' || plan.overallDecision !== 'READY') {
  recommendations.push({
    priority: 1,
    command: 'npm run doctor',
    reason: 'Readiness or orchestration is not READY.'
  });
}

if (!planeState.paused && readiness.overallDecision === 'READY' && plan.overallDecision === 'READY') {
  recommendations.push({
    priority: 2,
    command: 'npm run procure',
    reason: 'Core systems READY; run a full procurement check.'
  });
  recommendations.push({
    priority: 3,
    command: 'npm run dry-run',
    reason: 'Preview the decision without recording it.'
  });
}

if (recent.length === 0) {
  recommendations.push({
    priority: 3,
    command: 'npm run init && npm run procure',
    reason: 'No decisions recorded yet.'
  });
}

recommendations.push({
  priority: 4,
  command: 'npm run security-summary',
  reason: 'Review supply-chain and CI posture.'
});

recommendations.push({
  priority: 5,
  command: 'npm run report',
  reason: 'Human-readable summary of state and history.'
});

recommendations.sort((a, b) => a.priority - b.priority);

const result = {
  timestamp: new Date().toISOString(),
  paused: planeState.paused,
  readiness: readiness.overallDecision,
  orchestration: plan.overallDecision,
  lastDecision: live?.decision || recent[recent.length - 1]?.decision || null,
  recommendations,
  note: 'Ordered by priority. Lower number = do this first.'
};

console.log(JSON.stringify(result, null, 2));
