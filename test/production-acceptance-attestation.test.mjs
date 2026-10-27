import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import assert from 'node:assert/strict';
import {
  PRODUCTION_ACCEPTANCE_ISSUER,
  PRODUCTION_ACCEPTANCE_SCHEMA,
  canonicalAcceptanceJson,
  verifyProductionAcceptanceAttestation,
} from '../lib/production-acceptance-attestation.mjs';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
const keyId = 'unit-production-acceptance-key';
const buildId = 'build-sha-0123456789abcdef';
const residualSourceId = 'trusted-live-topology-measurer';
const now = Date.now();

function fixture(overrides = {}) {
  const body = {
    schema: PRODUCTION_ACCEPTANCE_SCHEMA,
    issuer: PRODUCTION_ACCEPTANCE_ISSUER,
    keyId,
    environment: 'production',
    buildId,
    generatedAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    gates: ['G0','G1','G2','G3','G4','G5','G6'].map(id => ({ id, status: 'PASS' })),
    residual: { schema: 'great-scale.residual-attestation/v1', sourceId: residualSourceId, buildId, measuredAt: new Date(now - 1000).toISOString(), S: 0 },
    ...overrides,
  };
  const payload = canonicalAcceptanceJson(body);
  return {
    ...body,
    digest: createHash('sha256').update(payload, 'utf8').digest('hex'),
    signature: sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64'),
  };
}
const options = { publicKeyPem: publicPem, keyId, buildId, residualSourceId, now };

const good = fixture();
assert.equal(verifyProductionAcceptanceAttestation(good, options).valid, true, 'valid signed G0-G6 attestation accepted');

const tampered = { ...good, environment: 'staging' };
assert.equal(verifyProductionAcceptanceAttestation(tampered, options).valid, false, 'tampered payload rejected');

const wrongKey = verifyProductionAcceptanceAttestation(good, { ...options, keyId: 'untrusted-key' });
assert.equal(wrongKey.valid, false, 'wrong pinned key id rejected');

const wrongBuild = verifyProductionAcceptanceAttestation(good, { ...options, buildId: 'different-build' });
assert.equal(wrongBuild.valid, false, 'wrong build identity rejected');

const stale = fixture({ generatedAt: new Date(now - 10 * 60_000).toISOString() });
assert.equal(verifyProductionAcceptanceAttestation(stale, options).valid, false, 'stale attestation rejected');

const incomplete = fixture({ gates: ['G0','G1','G2','G3','G4','G5'].map(id => ({ id, status: 'PASS' })) });
assert.equal(verifyProductionAcceptanceAttestation(incomplete, options).valid, false, 'missing production gate rejected');

const failGate = fixture({ gates: ['G0','G1','G2','G3','G4','G5','G6'].map((id, i) => ({ id, status: i === 6 ? 'FAIL' : 'PASS' })) });
assert.equal(verifyProductionAcceptanceAttestation(failGate, options).valid, false, 'failed production gate rejected');

assert.equal(verifyProductionAcceptanceAttestation(null, options).valid, false, 'missing attestation rejected');
assert.equal(verifyProductionAcceptanceAttestation(good, { ...options, publicKeyPem: '' }).valid, false, 'missing pinned key rejected');

const noResidual = { ...good };
delete noResidual.residual;
assert.equal(verifyProductionAcceptanceAttestation(noResidual, options).valid, false, 'missing residual measurement rejected');

const staleResidual = fixture({ residual: { schema: 'great-scale.residual-attestation/v1', sourceId: residualSourceId, buildId, measuredAt: new Date(now - 10 * 60_000).toISOString(), S: 0 } });
assert.equal(verifyProductionAcceptanceAttestation(staleResidual, options).valid, false, 'stale residual measurement rejected');

const wrongResidualSource = fixture({ residual: { schema: 'great-scale.residual-attestation/v1', sourceId: 'untrusted-source', buildId, measuredAt: new Date(now - 1000).toISOString(), S: 0 } });
assert.equal(verifyProductionAcceptanceAttestation(wrongResidualSource, options).valid, false, 'untrusted residual source rejected');

const outOfCone = fixture({ residual: { schema: 'great-scale.residual-attestation/v1', sourceId: residualSourceId, buildId, measuredAt: new Date(now - 1000).toISOString(), S: -1 } });
assert.equal(verifyProductionAcceptanceAttestation(outOfCone, options).valid, false, 'residual outside cone rejected');

console.log('production-acceptance-attestation.test.mjs: 12/12 passed');
