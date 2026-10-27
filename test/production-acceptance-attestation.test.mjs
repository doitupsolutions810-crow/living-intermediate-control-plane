import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import assert from 'node:assert/strict';
import { evaluateProductionAuthorization } from '../lib/gate-namespaces.mjs';
import {
  PRODUCTION_ACCEPTANCE_ISSUER,
  PRODUCTION_ACCEPTANCE_SCHEMA,
  PRODUCTION_GATE_POLICY,
  PRODUCTION_GATE_POLICY_VERSION,
  canonicalAcceptanceJson,
  productionGatePolicyDigest,
  verifyProductionAcceptanceAttestation,
} from '../lib/production-acceptance-attestation.mjs';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
const keyId = 'unit-production-acceptance-key';
const buildId = 'test-build-2026-10-27-1';
const residualSourceId = 'trusted-live-topology-measurer';
const repository = 'doitupsolutions810-crow/living-intermediate-control-plane';
const commitSha = 'a'.repeat(40);
const artifactDigest = 'sha256:' + 'b'.repeat(64);
const requiredSuiteNames = ['source-revision-binding', 'required-ci-suites-pass', 'immutable-artifact-provenance', 'supply-chain-attestation', 'security-policy-pass', 'runtime-health', 'residual-measurement'];
const runId = 12345;
const runAttempt = 2;
const runUrl = 'https://github.com/' + repository + '/actions/runs/' + runId;
const now = Date.now();

function sha(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function fixture(overrides = {}) {
  const suiteResults = requiredSuiteNames.map((name, index) => ({
    name,
    conclusion: 'success',
    headSha: commitSha,
    runId,
    runAttempt,
    evidenceUrl: runUrl + '/jobs/' + (900 + index),
    evidenceDigest: sha('suite-evidence:' + name),
  }));
  const suiteByName = new Map(suiteResults.map(suite => [suite.name, suite]));
  const body = {
    schema: PRODUCTION_ACCEPTANCE_SCHEMA,
    issuer: PRODUCTION_ACCEPTANCE_ISSUER,
    gatePolicyVersion: PRODUCTION_GATE_POLICY_VERSION,
    gatePolicyDigest: productionGatePolicyDigest(),
    keyId,
    environment: 'production',
    buildId,
    generatedAt: new Date(now - 500).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    source: { repository, commitSha },
    execution: {
      runId,
      runAttempt,
      runUrl,
      headSha: commitSha,
      conclusion: 'success',
      startedAt: new Date(now - 3000).toISOString(),
      completedAt: new Date(now - 1000).toISOString(),
    },
    artifact: { name: 'control-plane-release', digest: artifactDigest },
    suiteResults,
    gates: PRODUCTION_GATE_POLICY.map(gate => ({
      id: gate.id,
      policyId: gate.policyId,
      status: 'PASS',
      evidence: [{
        suiteName: gate.requiredSuiteName,
        evidenceDigest: suiteByName.get(gate.requiredSuiteName).evidenceDigest,
        observedAt: new Date(now - 1500).toISOString(),
      }],
    })),
    residual: {
      schema: 'great-scale.residual-attestation/v1',
      sourceId: residualSourceId,
      buildId,
      measuredAt: new Date(now - 1000).toISOString(),
      S: 0,
    },
    ...overrides,
  };
  const payload = canonicalAcceptanceJson(body);
  return {
    ...body,
    digest: sha(payload),
    signature: sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
  };
}

const options = {
  publicKeyPem: publicPem,
  keyId,
  buildId,
  residualSourceId,
  repository,
  commitSha,
  artifactDigest,
  requiredSuiteNames,
  now,
};

const good = fixture();
assert.equal(verifyProductionAcceptanceAttestation(good, options).valid, true,
  'valid proof-carrying G0-G6 attestation accepted');

assert.equal(verifyProductionAcceptanceAttestation(
  { ...good, environment: 'staging' }, options,
).valid, false, 'tampered signed payload rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  good, { ...options, keyId: 'untrusted-key' },
).valid, false, 'wrong pinned key id rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  good, { ...options, buildId: 'different-build' },
).valid, false, 'wrong build identity rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  good, { ...options, repository: 'another-owner/another-repository' },
).valid, false, 'wrong pinned source repository rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  good, { ...options, commitSha: 'c'.repeat(40) },
).valid, false, 'wrong pinned source commit rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  good, { ...options, artifactDigest: 'sha256:' + 'c'.repeat(64) },
).valid, false, 'wrong pinned artifact digest rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  good, { ...options, requiredSuiteNames: ['only-one-suite'] },
).valid, false, 'consumer policy cannot be weakened by the attestation suite set');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gatePolicyVersion: '0.9.0' }), options,
).valid, false, 'older gate policy version rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gatePolicyDigest: 'c'.repeat(64) }), options,
).valid, false, 'unrecognized gate policy digest rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gates: good.gates.map((gate, index) => index === 6
    ? { ...gate, policyId: 'runtime-health' } : gate) }), options,
).valid, false, 'gate policy ID cannot be substituted');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gates: good.gates.map((gate, index) => index === 0
    ? { ...gate, evidence: [{ ...gate.evidence[0], suiteName: 'required-ci-suites-pass', evidenceDigest: good.suiteResults[1].evidenceDigest }] } : gate) }), options,
).valid, false, 'gate evidence must use the policy-designated suite');


assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ generatedAt: new Date(now - 10 * 60_000).toISOString() }), options,
).valid, false, 'stale attestation rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ expiresAt: new Date(now - 1000).toISOString() }), options,
).valid, false, 'expired attestation rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ execution: {
    ...good.execution,
    startedAt: new Date(now - 20 * 60_000).toISOString(),
    completedAt: new Date(now - 10 * 60_000).toISOString(),
  } }), options,
).valid, false, 'old successful workflow run is not refreshed by a newly signed attestation');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({
    generatedAt: new Date(now - 1000).toISOString(),
    execution: {
      ...good.execution,
      startedAt: new Date(now - 10 * 60_000).toISOString(),
      completedAt: new Date(now - 6 * 60_000).toISOString(),
    },
  }), options,
).valid, false, 'workflow evidence stale at attestation generation is rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gates: ['G0','G1','G2','G3','G4','G5'].map(id => ({ id, status: 'PASS', evidence: [] })) }), options,
).valid, false, 'missing production gate rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gates: ['G0','G1','G2','G3','G4','G5','G6'].map((id, i) => ({
    id, status: i === 6 ? 'FAIL' : 'PASS', evidence: [],
  })) }), options,
).valid, false, 'failed production gate rejected');

assert.equal(verifyProductionAcceptanceAttestation(null, options).valid, false,
  'missing attestation rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  good, { ...options, publicKeyPem: '' },
).valid, false, 'missing pinned key rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ source: { repository, commitSha: 'f'.repeat(40) } }), options,
).valid, false, 'source revision drift rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ execution: { ...good.execution, headSha: 'c'.repeat(40) } }), options,
).valid, false, 'workflow head must match the source revision');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ execution: { ...good.execution, runUrl: 'https://github.com/other/repo/actions/runs/12345' } }), options,
).valid, false, 'workflow URL must bind to source repository and run ID');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ execution: { ...good.execution, conclusion: 'failure' } }), options,
).valid, false, 'failed workflow is non-authorizing');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ suiteResults: good.suiteResults.slice(0, 1) }), options,
).valid, false, 'missing required suite result rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ suiteResults: [good.suiteResults[0], { ...good.suiteResults[1], name: good.suiteResults[0].name }] }), options,
).valid, false, 'duplicate suite result rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ suiteResults: good.suiteResults.map((suite, index) => index === 1
    ? { ...suite, headSha: 'd'.repeat(40) } : suite) }), options,
).valid, false, 'suite result from another revision rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ suiteResults: good.suiteResults.map((suite, index) => index === 1
    ? { ...suite, runAttempt: 1 } : suite) }), options,
).valid, false, 'suite result from another run attempt rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ suiteResults: good.suiteResults.map((suite, index) => index === 1
    ? { ...suite, evidenceUrl: 'https://evil.example.test/evidence' } : suite) }), options,
).valid, false, 'suite evidence URL must be pinned to the workflow run');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gates: good.gates.map((gate, index) => index === 0
    ? { ...gate, evidence: [{ ...gate.evidence[0], suiteName: 'undeclared-suite' }] } : gate) }), options,
).valid, false, 'gate may not reference an undeclared suite');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gates: good.gates.map((gate, index) => index === 0
    ? { ...gate, evidence: [{ ...gate.evidence[0], evidenceDigest: 'c'.repeat(64) }] } : gate) }), options,
).valid, false, 'gate evidence digest must match signed suite evidence');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gates: good.gates.map((gate, index) => index === 0
    ? { ...gate, evidence: [{ ...gate.evidence[0], observedAt: new Date(now + 60_000).toISOString() }] } : gate) }), options,
).valid, false, 'future gate evidence timestamp rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ artifact: { name: 'control-plane-release', digest: 'sha256:' + 'c'.repeat(64) } }), options,
).valid, false, 'artifact digest is bound to the independently pinned digest');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ gates: ['E0','E1','E2','E3','E4','E5','E6'].map(id => ({
    id, status: 'PASS', evidence: [],
  })) }), options,
).valid, false, 'signed E0-E6 procurement checks cannot be relabeled as G0-G6 production acceptance');

const eNamespaceProducerDocument = {
  schema: 'great-scale.evidence-status/v5.4.0',
  issuer: 'control12-evidence-console',
  version: '5.4.0',
  runtime: 'read-only-dynamic',
  contractChecks: ['E0','E1','E2','E3','E4','E5','E6'].map(id => ({ id, status: 'READY' })),
  generatedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 60_000).toISOString(),
  digest: good.digest,
  keyId,
  signature: good.signature,
};
assert.equal(verifyProductionAcceptanceAttestation(eNamespaceProducerDocument, options).valid, false,
  'E0-E6 producer document is not a G0-G6 acceptance artifact');

const callerTrustOverride = evaluateProductionAuthorization({
  coreReady: true,
  supplyChainOk: true,
  productionAcceptanceAttestation: good,
  acceptanceVerificationOptions: options,
  env: {},
  config: {},
  S: 0,
  requireCone: true,
});
assert.equal(callerTrustOverride.productionAuthorized, false,
  'caller-supplied verifier options cannot override deployment trust anchors');


assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ execution: { ...good.execution, startedAt: new Date(now + 60_000).toISOString() } }), options,
).valid, false, 'workflow start time in the future rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ execution: { ...good.execution, startedAt: new Date(now - 500).toISOString() } }), options,
).valid, false, 'workflow start after completion rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ generatedAt: 'October 27, 2026 00:00:00 GMT' }), options,
).valid, false, 'non-RFC3339 but Date.parse-compatible attestation timestamp rejected');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ expiresAt: '2026-02-30T00:00:00Z' }), options,
).valid, false, 'impossible calendar date rejected instead of normalized by Date.parse');

assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ residual: { ...good.residual, measuredAt: 'October 27, 2026 00:00:00 GMT' } }), options,
).valid, false, 'residual measurement timestamp must use strict RFC3339');
 
assert.equal(verifyProductionAcceptanceAttestation(
  fixture({ residual: { ...good.residual, S: 0.25 } }), options,
).valid, true, 'upper topology-domain boundary S=0.25 accepted');

const negativeResidualDomain = verifyProductionAcceptanceAttestation(
  fixture({ residual: { ...good.residual, S: -0.000001 } }), options,
);
assert.equal(negativeResidualDomain.valid, false, 'negative residual coordinate rejected even when cone epsilon might tolerate it');
assert.ok(negativeResidualDomain.failures.includes('residual_value_out_of_domain'));

const highResidualDomain = verifyProductionAcceptanceAttestation(
  fixture({ residual: { ...good.residual, S: 0.250001 } }), options,
);
assert.equal(highResidualDomain.valid, false, 'residual coordinate above 0.25 rejected');
assert.ok(highResidualDomain.failures.includes('residual_value_out_of_domain'));

const extremeSignedResidual = verifyProductionAcceptanceAttestation(
  fixture({ residual: { ...good.residual, S: 100 } }), options,
);
assert.equal(extremeSignedResidual.valid, false, 'a correctly signed but impossible residual cannot pass G6');
assert.ok(extremeSignedResidual.failures.includes('residual_value_out_of_domain'));

console.log('production-acceptance-attestation: proof-carrying positive/negative assertions passed');
