#!/usr/bin/env node
/**
 * Self-test for Living Intermediate Control Plane
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { handleLaunchDeskAction, listNamedActions } from '../launchdesk/actions.mjs';
import { readPlaneState } from '../status/plane-state.mjs';
import { probeEvidenceConsole } from '../lib/evidence-console.mjs';
import { acceptsLocalEvidence } from '../lib/evidence-authorization.mjs';
import { evaluateProcurementReadiness } from '../lib/gate-namespaces.mjs';

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
// Authority policy: local fallback is never implicit procurement authorization.
assert(acceptsLocalEvidence({ env: {}, config: {} }) === false, 'local evidence rejected by default');
assert(acceptsLocalEvidence({ env: { ACCEPT_LOCAL_EVIDENCE: '1' }, config: {} }) === true, 'local evidence explicit env opt-in accepted');
assert(acceptsLocalEvidence({ env: { ACCEPT_LOCAL_EVIDENCE: 'true' }, config: {} }) === true, 'local evidence true env opt-in accepted');
assert(acceptsLocalEvidence({ env: {}, config: { acceptLocalEvidenceByDefault: true } }) === true, 'local evidence explicit config opt-in accepted');
assert(acceptsLocalEvidence({ env: {}, config: { acceptLocalEvidenceByDefault: false } }) === false, 'false config does not authorize local evidence');

// Gate namespace must not infer contract validity from a status label.
const gateOptions = { coreReady: true, env: {}, config: {}, S: 0, requireCone: false };
assert(evaluateProcurementReadiness({
  ...gateOptions,
  evidenceConsole: { status: 'ok', authority: 'public', trustContractVerified: false }
}).evidenceAuthorized === false, 'public status without verified contract is denied by gate namespace');
assert(evaluateProcurementReadiness({
  ...gateOptions,
  evidenceConsole: { status: 'ok', authority: 'public', trustContractVerified: true }
}).evidenceAuthorized === true, 'public status with verified contract is accepted by gate namespace');
assert(evaluateProcurementReadiness({
  ...gateOptions,
  env: { ACCEPT_LOCAL_EVIDENCE: '1' },
  evidenceConsole: { authority: 'local' }
}).evidenceAuthorized === false, 'local opt-in without observed degraded status is denied');
assert(evaluateProcurementReadiness({
  ...gateOptions,
  env: { ACCEPT_LOCAL_EVIDENCE: '1' },
  evidenceConsole: { status: 'unreachable', authority: 'local' }
}).evidenceAuthorized === true, 'explicit local opt-in plus recognized degraded status is accepted');
assert(evaluateProcurementReadiness({
  ...gateOptions,
  env: { ACCEPT_LOCAL_EVIDENCE: '1' },
  evidenceConsole: { status: 'invalid', authority: 'public', trustContractVerified: false }
}).evidenceAuthorized === false, 'public-labeled invalid response cannot be reclassified as local fallback');
assert(evaluateProcurementReadiness({
  ...gateOptions,
  evidenceConsole: { status: 'unreachable', authority: 'local' }
}).evidenceAuthorized === false, 'recognized local fallback without opt-in is denied');

const packageScripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
assert(packageScripts.procure === 'node integrate.mjs procure', 'default procure does not force local evidence');
assert(packageScripts['procure:gated'] === 'GATE_DOCTOR=1 node integrate.mjs procure', 'gated procure does not force local evidence');
assert(packageScripts['procure:local'] === 'ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs procure', 'local evidence requires named opt-in command');
assert(packageScripts['procure:gated:local'] === 'GATE_DOCTOR=1 ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs procure', 'gated local mode is explicitly named');



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

const reachableUnverified = await probeEvidenceConsole({
  url: 'https://evidence.example.invalid/console',
  acceptLocal: true,
  fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  verifyDocument: async () => ({ valid: false, failures: [{ code: 'SCHEMA' }] })
});
assert(reachableUnverified.status === 'invalid', 'HTTP 200 without verified evidence contract is invalid');
assert(reachableUnverified.authority === 'public', 'reachable but unverified endpoint is not downgraded to local authority');
assert(reachableUnverified.trustContractVerified === false, 'unverified response explicitly denies trust contract');
assert(evaluateProcurementReadiness({
  ...gateOptions,
  env: { ACCEPT_LOCAL_EVIDENCE: '1' },
  evidenceConsole: reachableUnverified
}).evidenceAuthorized === false, 'reachable but cryptographically unverified source cannot authorize via local fallback');

const ok = await probeEvidenceConsole({
  url: 'https://evidence.example.invalid/console',
  acceptLocal: true,
  fetchImpl: async () => new Response(JSON.stringify({ schema: 'test-fixture' }), { status: 200 }),
  verifyDocument: async doc => ({
    valid: doc.schema === 'test-fixture',
    failures: doc.schema === 'test-fixture' ? [] : [{ code: 'SCHEMA' }]
  })
});
assert(ok.status === 'ok', 'verified evidence document maps to ok');
assert(ok.authority === 'public', 'verified evidence document uses public authority');
assert(ok.trustContractVerified === true, 'verified response exposes explicit trust-contract proof');
assert(Array.isArray(ok.verificationFailures) && ok.verificationFailures.length === 0, 'verified response has no contract failures');

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
