#!/usr/bin/env node
/**
 * Self-test for Living Intermediate Control Plane
 */

import { existsSync, readFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { handleLaunchDeskAction, listNamedActions } from '../launchdesk/actions.mjs';
import { readPlaneState } from '../status/plane-state.mjs';
import { probeEvidenceConsole } from '../lib/evidence-console.mjs';
import { acceptsLocalEvidence } from '../lib/evidence-authorization.mjs';
import { parseResidualInput, residualInputGateEligible } from '../lib/residual-input.mjs';
import { evaluateProductionAuthorization } from '../lib/gate-namespaces.mjs';
import { canonicalAttestationJson } from '../lib/measurement-attestation.mjs';

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
// Residual input is parsed strictly; invalid values cannot silently become S=0.
const residualDefault = parseResidualInput(undefined);
assert(residualDefault.valid && !residualDefault.provided && residualDefault.value === 0 && residualDefault.source === 'default' && residualDefault.decision === 'HOLD_RESIDUAL_UNSET', 'unset residual is explicitly labeled default and not treated as supplied input');
assert(residualInputGateEligible(residualDefault) === false, 'unset residual default cannot satisfy residual gate');
for (const raw of ['0', '0.125', '0.25', '.125', '1.25e-1']) {
  const parsed = parseResidualInput(raw);
  assert(parsed.valid && parsed.provided && parsed.decision === null, 'valid residual accepted: ' + raw);
  assert(residualInputGateEligible(parsed) === true, 'explicit valid residual can satisfy input eligibility: ' + raw);
}
for (const raw of ['', '   ', 'NaN', 'Infinity', '-Infinity', 'bad', '0x10', '1e999', '1e-999']) {
  const parsed = parseResidualInput(raw);
  assert(!parsed.valid && parsed.provided && parsed.decision === 'HOLD_INVALID_RESIDUAL', 'malformed/non-finite residual rejected: ' + raw);
  assert(residualInputGateEligible(parsed) === false, 'malformed residual cannot satisfy gate: ' + raw);
}
for (const raw of ['-0.0001', '-0.125', '0.2500001', '1', '1e100']) {
  const parsed = parseResidualInput(raw);
  assert(!parsed.valid && parsed.provided && parsed.decision === 'HOLD_RESIDUAL_DOMAIN', 'out-of-domain residual rejected: ' + raw);
  assert(residualInputGateEligible(parsed) === false, 'out-of-domain residual cannot satisfy gate: ' + raw);
}

// Invalid residual input must not be mislabeled as merely awaiting public evidence.
const integrationSource = readFileSync(join(root, 'integrate.mjs'), 'utf8');
assert(integrationSource.includes('coreReady && residualInputGateEligible(residualInput) && !gates.procurement.evidenceAuthorized'), 'invalid or unset residual cannot produce local-evidence readiness label');
assert(integrationSource.includes('coreReady: coreReady && residualInputGateEligible(residualInput)'), 'integration delegates residual gate eligibility to tested helper');

// Production authorization is a distinct namespace and fails closed without each prerequisite.
assert(evaluateProductionAuthorization().productionAuthorized === false, 'production authorization denied by default');
assert(evaluateProductionAuthorization({ coreReady: true, supplyChainOk: true }).productionAuthorized === false, 'production authorization denied without verified measurement attestation');
assert(evaluateProductionAuthorization({ coreReady: true, supplyChainOk: true, measurementAttestationVerified: true }).productionAuthorized === false, 'legacy caller-supplied verification boolean cannot authorize production');
assert(evaluateProductionAuthorization({ coreReady: true, measurementAttestationVerified: true }).productionAuthorized === false, 'production authorization denied without supply-chain authorization');
assert(evaluateProductionAuthorization({ supplyChainOk: true, measurementAttestationVerified: true }).productionAuthorized === false, 'production authorization denied without core readiness');
const attestationKeys = generateKeyPairSync('ed25519');
const expectedMeasurementIdentity = {
  issuer: 'https://ci.example.test',
  repository: 'doitupsolutions810-crow/living-intermediate-control-plane',
  commitSha: '0123456789abcdef0123456789abcdef01234567',
  runId: 'run-123',
  artifactDigest: 'sha256:' + 'a'.repeat(64),
  nonce: 'challenge-nonce-unique-001',
};
const measurementPayload = {
  schema: 'control-plane.measurement-attestation/v1',
  ...expectedMeasurementIdentity,
  residualS: 0.125,
  measuredAt: new Date(Date.now() - 1000).toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  keyId: 'test-measurement-key',
};
const signedMeasurementAttestation = {
  ...measurementPayload,
  signature: sign(null, Buffer.from(canonicalAttestationJson(measurementPayload), 'utf8'), attestationKeys.privateKey).toString('base64'),
};
const productionAuthorizationOptions = {
  coreReady: true,
  supplyChainOk: true,
  S: 0.125,
  measurementAttestation: signedMeasurementAttestation,
  measurementAttestationExpected: expectedMeasurementIdentity,
  measurementAttestationPublicKeyPem: attestationKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  measurementAttestationKeyId: 'test-measurement-key',
};
assert(evaluateProductionAuthorization(productionAuthorizationOptions).productionAuthorized === true, 'production gate accepts a valid signed attestation bound to expected identity');
const tamperedAttestation = { ...signedMeasurementAttestation, residualS: 0.2 };
assert(evaluateProductionAuthorization({ ...productionAuthorizationOptions, measurementAttestation: tamperedAttestation }).productionAuthorized === false, 'production gate rejects a tampered measurement payload');
assert(evaluateProductionAuthorization({ ...productionAuthorizationOptions, measurementAttestationExpected: { ...expectedMeasurementIdentity, commitSha: 'ffffffffffffffffffffffffffffffffffffffff' } }).productionAuthorized === false, 'production gate rejects an attestation bound to a different commit');
assert(evaluateProductionAuthorization({ ...productionAuthorizationOptions, measurementAttestationExpected: { ...expectedMeasurementIdentity, nonce: 'different-challenge-nonce' } }).productionAuthorized === false, 'production gate rejects an attestation bound to a different challenge nonce');
const expiredPayload = { ...measurementPayload, measuredAt: new Date(Date.now() - 120_000).toISOString(), expiresAt: new Date(Date.now() - 60_000).toISOString() };
const expiredAttestation = { ...expiredPayload, signature: sign(null, Buffer.from(canonicalAttestationJson(expiredPayload), 'utf8'), attestationKeys.privateKey).toString('base64') };
assert(evaluateProductionAuthorization({ ...productionAuthorizationOptions, measurementAttestation: expiredAttestation }).productionAuthorized === false, 'production gate rejects an expired signed measurement attestation');

const longLivedPayload = { ...measurementPayload, measuredAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 11 * 60_000).toISOString() };
const longLivedAttestation = { ...longLivedPayload, signature: sign(null, Buffer.from(canonicalAttestationJson(longLivedPayload), 'utf8'), attestationKeys.privateKey).toString('base64') };
assert(evaluateProductionAuthorization({ ...productionAuthorizationOptions, measurementAttestation: longLivedAttestation }).productionAuthorized === false, 'production gate rejects attestations with a lifetime over ten minutes');

// Authority policy: local fallback is never implicit procurement authorization.
assert(acceptsLocalEvidence({ env: {}, config: {} }) === false, 'local evidence rejected by default');
assert(acceptsLocalEvidence({ env: { ACCEPT_LOCAL_EVIDENCE: '1' }, config: {} }) === true, 'local evidence explicit env opt-in accepted');
assert(acceptsLocalEvidence({ env: { ACCEPT_LOCAL_EVIDENCE: 'true' }, config: {} }) === true, 'local evidence true env opt-in accepted');
assert(acceptsLocalEvidence({ env: {}, config: { acceptLocalEvidenceByDefault: true } }) === true, 'local evidence explicit config opt-in accepted');
assert(acceptsLocalEvidence({ env: {}, config: { acceptLocalEvidenceByDefault: false } }) === false, 'false config does not authorize local evidence');
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
