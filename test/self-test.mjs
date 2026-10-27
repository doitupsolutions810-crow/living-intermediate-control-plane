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
import { acceptsLocalEvidence, isEvidenceAuthorized } from '../lib/evidence-authorization.mjs';
import { evaluateSupplyChainEvidence } from '../lib/supply-chain-evidence.mjs';

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
assert(isEvidenceAuthorized({ status: 'ok', authority: 'public', localOptIn: false }) === true, 'verified public evidence authorizes');
assert(isEvidenceAuthorized({ status: 'unreachable', authority: 'local', localOptIn: true }) === true, 'explicit local opt-in authorizes local fallback');
assert(isEvidenceAuthorized({ status: 'unreachable', authority: 'local', localOptIn: false }) === false, 'local fallback without opt-in denied');
assert(isEvidenceAuthorized({ status: 'ok', authority: 'unknown', localOptIn: false }) === false, 'unknown authority denied');
assert(isEvidenceAuthorized({ status: 'not_found', authority: 'local', localOptIn: false, force: true }) === false, 'force flag cannot manufacture evidence authorization');
const packageScripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
assert(packageScripts.procure === 'node integrate.mjs procure', 'default procure does not force local evidence');
assert(packageScripts['procure:gated'] === 'GATE_DOCTOR=1 node integrate.mjs procure', 'gated procure does not force local evidence');
assert(packageScripts['procure:local'] === 'ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs procure', 'local evidence requires named opt-in command');
assert(packageScripts['procure:gated:local'] === 'GATE_DOCTOR=1 ACCEPT_LOCAL_EVIDENCE=1 node integrate.mjs procure', 'gated local mode is explicitly named');
const bridgeSource = readFileSync(join(root, 'status/procurement-bridge.mjs'), 'utf8');
assert(bridgeSource.includes('isEvidenceAuthorized'), 'procurement bridge uses shared evidence authorization policy');
assert(!bridgeSource.includes("process.env.FORCE_PROCUREMENT === '1'"), 'procurement bridge has no force authorization bypass');
assert(bridgeSource.includes('evaluateSupplyChainEvidence'), 'procurement bridge validates supply-chain evidence rather than assuming it active');
const supplyChainSource = readFileSync(join(root, 'status/supply-chain.mjs'), 'utf8');
assert(supplyChainSource.includes("SKIP_TRIVY: '0'"), 'supply-chain run overrides inherited Trivy skip flag');
assert(supplyChainSource.includes("SKIP_SNYK: '0'"), 'supply-chain run overrides inherited Snyk skip flag');
assert(supplyChainSource.includes("SKIP_SNYK_CONTAINER: '0'"), 'supply-chain run overrides inherited Snyk container skip flag');
assert(supplyChainSource.includes("SKIP_OPA: '0'"), 'supply-chain run overrides inherited OPA skip flag');
const evidenceSource = readFileSync(join(root, 'lib/evidence-console.mjs'), 'utf8');
assert(evidenceSource.includes('contract has not been validated'), 'unvalidated public evidence fails closed');

// Supply-chain authorization requires fresh, revision-bound, non-skipped scan and signature evidence.
const fixedNow = Date.parse('2026-10-26T12:00:00.000Z');
const validSupplyReport = {
  timestamp: '2026-10-26T11:50:00.000Z',
  revision: 'abc123',
  ok: true,
  failed: 0,
  allowSkip: false,
  imageRef: 'ghcr.io/example/app@sha256:1234',
  signed: true,
  results: [
    { name: 'security-scan', ok: true, status: 0 },
    { name: 'cosign-sign', ok: true, status: 0 },
    { name: 'cosign-verify', ok: true, status: 0 },
    { name: 'security-summary', ok: true, status: 0 }
  ]
};
assert(evaluateSupplyChainEvidence({ report: validSupplyReport, revision: 'abc123', nowMs: fixedNow }).authorized === true, 'fresh fully verified supply-chain report authorizes');
assert(evaluateSupplyChainEvidence({ report: validSupplyReport, revision: 'different', nowMs: fixedNow }).authorized === false, 'supply-chain report for another revision denied');
assert(evaluateSupplyChainEvidence({ report: { ...validSupplyReport, allowSkip: true }, revision: 'abc123', nowMs: fixedNow }).authorized === false, 'soft-skip supply-chain report denied');
assert(evaluateSupplyChainEvidence({ report: { ...validSupplyReport, results: [...validSupplyReport.results, { name: 'trivy', ok: true, skipped: true }] }, revision: 'abc123', nowMs: fixedNow }).authorized === false, 'report with skipped security tool denied');
assert(evaluateSupplyChainEvidence({ report: { ...validSupplyReport, signed: false }, revision: 'abc123', nowMs: fixedNow }).authorized === false, 'unsigned image denied');
assert(evaluateSupplyChainEvidence({ report: { ...validSupplyReport, timestamp: '2026-10-26T10:00:00.000Z' }, revision: 'abc123', nowMs: fixedNow }).authorized === false, 'stale supply-chain report denied');
assert(evaluateSupplyChainEvidence({ report: validSupplyReport, revision: '', nowMs: fixedNow }).authorized === false, 'unknown current revision denied');

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
assert(ok.status === 'invalid', 'evidence-console 200 without validated contract is invalid');
assert(ok.authority === 'local', 'unvalidated 2xx cannot claim public authority');

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
