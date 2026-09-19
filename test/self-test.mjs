#!/usr/bin/env node
/**
 * Self-test for Living Intermediate Control Plane
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { handleLaunchDeskAction, listNamedActions } from '../launchdesk/actions.mjs';
import { readPlaneState } from '../status/plane-state.mjs';
import { probeEvidenceConsole } from '../lib/evidence-console.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

console.log('Self-test — Living Intermediate Control Plane\n');

const readiness = emitReadinessEvidence({ source: 'self-test' });
assert(readiness.provider === 'deterministic-local-evidence', 'readiness provider is deterministic-local-evidence');
assert(readiness.overallDecision === 'READY', 'readiness overallDecision is READY');
assert(Array.isArray(readiness.failedGates) && readiness.failedGates.length === 0, 'no failed gates');
assert(readiness.securityValue === 'High', 'securityValue is High');

const plan = evaluateQuorum(createOrchestrationPlan('self-test'));
assert(plan.overallDecision === 'READY', 'orchestration overallDecision is READY');
assert(plan.roles.length === 5, 'five roles present');
assert(plan.roles.every(r => r.status === 'READY'), 'all five roles READY');

const action = handleLaunchDeskAction('status', 'self-test');
assert(action.accepted === true, 'LaunchDesk action accepted');
assert(action.decision === 'READY', 'LaunchDesk decision is READY');
assert(action.knownAction === true, 'status is a known named action');

const named = listNamedActions();
assert(named.length >= 5, 'named LaunchDesk actions present');
assert(named.some(a => a.name === 'procure'), 'procure action exists');
assert(named.some(a => a.name === 'pause'), 'pause action exists');

const state = readPlaneState();
assert(typeof state.paused === 'boolean', 'plane state readable');

assert(existsSync(join(root, 'policy/trivy-results.rego')), 'trivy policy present');
assert(existsSync(join(root, 'policy/snyk-results.rego')), 'snyk policy present');
assert(existsSync(join(root, 'Dockerfile')), 'Dockerfile present');
assert(existsSync(join(root, 'status/checklist.mjs')), 'checklist present');
assert(existsSync(join(root, 'status/metrics.mjs')), 'metrics present');

// avrone-chat ship surface
assert(existsSync(join(root, 'avrone-chat/package.json')), 'avrone-chat package.json present');
assert(existsSync(join(root, 'avrone-chat/vercel.json')), 'avrone-chat vercel.json present');
assert(existsSync(join(root, 'avrone-chat/.env.example')), 'avrone-chat env example present');
assert(existsSync(join(root, 'avrone-chat/app/page.tsx')), 'avrone-chat page present');
assert(existsSync(join(root, 'avrone-chat/app/api/health/route.ts')), 'avrone-chat health route present');
assert(existsSync(join(root, 'avrone-chat/app/api/cockpit/route.ts')), 'avrone-chat cockpit route present');

// evidence-console graceful behavior (stubbed fetch — no network)
const unset = await probeEvidenceConsole({ url: '', acceptLocal: true });
assert(unset.status === 'unconfigured', 'evidence-console unconfigured when URL empty');
assert(unset.authority === 'local', 'unconfigured console uses local authority');

const notFound = await probeEvidenceConsole({
  url: 'https://evidence.example.invalid/console',
  acceptLocal: true,
  fetchImpl: async () => new Response('missing', { status: 404 })
});
assert(notFound.status === 'not_found', 'evidence-console 404 maps to not_found');
assert(notFound.authority === 'local', '404 console falls back to local authority');
assert(notFound.httpStatus === 404, '404 httpStatus preserved');

const ok = await probeEvidenceConsole({
  url: 'https://evidence.example.invalid/console',
  acceptLocal: true,
  fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
});
assert(ok.status === 'ok', 'evidence-console 200 maps to ok');
assert(ok.authority === 'public', 'healthy console uses public authority');

const boom = await probeEvidenceConsole({
  url: 'https://evidence.example.invalid/console',
  acceptLocal: true,
  fetchImpl: async () => {
    throw new Error('network down');
  }
});
assert(boom.status === 'unreachable', 'evidence-console network error maps to unreachable');
assert(boom.authority === 'local', 'unreachable console falls back to local authority');

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
