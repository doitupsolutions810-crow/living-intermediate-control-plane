#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlaneState } from './plane-state.mjs';
import { readRecentDecisions } from './decision-log.mjs';
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { isAuthorized, readSession } from '../agents/llama/session.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const planeState = readPlaneState();
const readiness = emitReadinessEvidence({ source: 'next-advisor' });
const plan = evaluateQuorum(createOrchestrationPlan('next-advisor'));
const recent = readRecentDecisions(5);
const agentAuth = isAuthorized(root);

const recommendations = [];

if (planeState.paused) {
  recommendations.push({ priority: 1, command: 'plane resume', reason: 'Plane is paused.' });
}
if (readiness.overallDecision !== 'READY' || plan.overallDecision !== 'READY') {
  recommendations.push({ priority: 1, command: 'plane doctor', reason: 'Readiness or orchestration not READY.' });
}
if (!planeState.paused && readiness.overallDecision === 'READY') {
  recommendations.push({ priority: 2, command: 'plane unattended', reason: 'Run full unattended maintain + self-develop gates.' });
  recommendations.push({ priority: 2, command: 'plane checklist && plane procure', reason: 'Manual procure path.' });
}
if (!agentAuth) {
  recommendations.push({
    priority: 3,
    command: 'plane agent-chat',
    reason: 'Authorize Llama toolkit via chat (no outside sandbox until then).'
  });
} else {
  const s = readSession(root);
  recommendations.push({
    priority: 3,
    command: 'plane agent-run -- "queue a verify task"',
    reason: `Agent session active until ${s?.expiresAt || 'unknown'}; allowlisted tools need no per-action approve.`
  });
  recommendations.push({
    priority: 3,
    command: 'plane admit-change',
    reason: 'Admit workspace/agent proposals under plane gates.'
  });
}
recommendations.push({ priority: 4, command: 'plane security-scan', reason: 'Trivy + Snyk + OPA when tools exist.' });
recommendations.push({ priority: 5, command: 'plane verify-changes', reason: 'Confirm docs/agent layout.' });

recommendations.sort((a, b) => a.priority - b.priority);

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  paused: planeState.paused,
  readiness: readiness.overallDecision,
  orchestration: plan.overallDecision,
  agentAuthorized: agentAuth,
  lastDecision: recent[recent.length - 1]?.decision || null,
  recommendations,
  note: 'Lower priority number = do first.'
}, null, 2));
