#!/usr/bin/env node
/**
 * Next-steps advisor
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
    command: 'plane resume',
    reason: 'Plane is paused; clear the hold before procuring.'
  });
}

if (readiness.overallDecision !== 'READY' || plan.overallDecision !== 'READY') {
  recommendations.push({
    priority: 1,
    command: 'plane doctor',
    reason: 'Readiness or orchestration is not READY.'
  });
}

if (!planeState.paused && readiness.overallDecision === 'READY' && plan.overallDecision === 'READY') {
  recommendations.push({
    priority: 2,
    command: 'plane checklist',
    reason: 'Run pre-flight before procure.'
  });
  recommendations.push({
    priority: 2,
    command: 'plane procure',
    reason: 'Core systems READY; run a full procurement check.'
  });
}

recommendations.push({
  priority: 3,
  command: 'plane security-scan',
  reason: 'Trivy + Snyk + OPA when tools are installed.'
});

if (existsSync(join(root, 'Dockerfile'))) {
  recommendations.push({
    priority: 4,
    command: 'npm run docker:build && IMAGE_REF=living-intermediate-control-plane:0.5.0 plane cosign-sign',
    reason: 'Build image then sign with Cosign (Rekor upload on by default).'
  });
  recommendations.push({
    priority: 4,
    command: 'IMAGE_REF=living-intermediate-control-plane:0.5.0 plane cosign-verify',
    reason: 'Verify Cosign signature / Rekor entry when image was signed.'
  });
}

recommendations.push({
  priority: 5,
  command: 'plane rekor version',
  reason: 'Confirm rekor-cli (brew install rekor-cli) for log queries.'
});

recommendations.push({
  priority: 5,
  command: 'plane metrics',
  reason: 'Decision outcome counts.'
});

recommendations.sort((a, b) => a.priority - b.priority);

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  paused: planeState.paused,
  readiness: readiness.overallDecision,
  orchestration: plan.overallDecision,
  lastDecision: live?.decision || recent[recent.length - 1]?.decision || null,
  recommendations,
  note: 'Ordered by priority. Lower number = do this first.'
}, null, 2));
