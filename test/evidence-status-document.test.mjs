/** Residual-aware evidence status document — focused unit checks */
import { generateKeyPairSync } from 'node:crypto';
import { strict as assert } from 'node:assert';
import {
  buildEvidenceStatusDocument,
  sealEvidenceStatusDocument,
  verifyEvidenceStatusDocument,
} from '../lib/evidence-status-document.mjs';
import { authorizeWithCone } from '../lib/evidence-authorization.mjs';
import { residualSnapshot } from '../lib/great-scale-residual.mjs';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
const keyId = 'unit-test-key';

// 1. Unsigned local verify with allow path
{
  const doc = buildEvidenceStatusDocument({ S: 0.05, roleBlock: 4 });
  const sealed = sealEvidenceStatusDocument(doc);
  assert.equal(sealed.signature, null);
  const r = verifyEvidenceStatusDocument(sealed, { requireSignature: false });
  assert.equal(r.valid, true);
  assert.equal(r.productionClaimed, false);
  assert.equal(r.residual.coneOk, true);
}

// 2. Signed round-trip
{
  const doc = buildEvidenceStatusDocument({ S: 0.1, roleBlock: 3 });
  const sealed = sealEvidenceStatusDocument(doc, { privateKeyPem: privPem, keyId });
  assert.ok(sealed.signature);
  const r = verifyEvidenceStatusDocument(sealed, {
    publicKeyPem: pubPem,
    keyId,
    requireSignature: true,
  });
  assert.equal(r.valid, true);
  assert.equal(sealed.residual.role, 'Observer');
}

// 3. Exact E0–E6
{
  const doc = buildEvidenceStatusDocument({ S: 0 });
  assert.equal(doc.contractChecks.length, 7);
  assert.deepEqual(
    doc.contractChecks.map(c => c.id).sort(),
    ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6']
  );
}

// 4. Tamper digest fails
{
  const doc = buildEvidenceStatusDocument({ S: 0.02 });
  const sealed = sealEvidenceStatusDocument(doc, { privateKeyPem: privPem, keyId });
  sealed.residual = { ...sealed.residual, S: 0.99 };
  const r = verifyEvidenceStatusDocument(sealed, {
    publicKeyPem: pubPem,
    keyId,
    requireSignature: true,
  });
  assert.equal(r.valid, false);
  assert.ok(r.failures.some(f => f.code === 'DIGEST' || f.code === 'SIGNATURE'));
}

// 5. Missing signature fails when required
{
  const doc = buildEvidenceStatusDocument({ S: 0 });
  const sealed = sealEvidenceStatusDocument(doc);
  const r = verifyEvidenceStatusDocument(sealed, {
    publicKeyPem: pubPem,
    keyId,
    requireSignature: true,
  });
  assert.equal(r.valid, false);
  assert.ok(r.failures.some(f => f.code === 'SIGNATURE'));
}

// 6. Out-of-domain residual cannot be upgraded by caller-asserted READY checks.
{
  const contractChecks = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'].map(id => ({
    id, status: 'READY',
  }));
  const doc = buildEvidenceStatusDocument({ S: 100, contractChecks });
  assert.equal(doc.residual.coneOk, false);
  assert.ok(doc.contractChecks.every(check => check.status === 'HOLD'));
}

// 7. A valid signature does not make an out-of-domain residual acceptable.
{
  const doc = buildEvidenceStatusDocument({ S: 100 });
  // Simulate a signer incorrectly claiming the lower-bound cone check passed.
  doc.residual.coneOk = true;
  const signed = sealEvidenceStatusDocument(doc, { privateKeyPem: privPem, keyId });
  const result = verifyEvidenceStatusDocument(signed, {
    publicKeyPem: pubPem, keyId, requireSignature: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(f => f.code === 'RESIDUAL_DOMAIN'));
}

// 8. Raw residual snapshots and local authorization must enforce the full domain.
{
  for (const S of [-1e-6, 0.250001, 100, Infinity, -Infinity, NaN, '0.1']) {
    const snapshot = residualSnapshot({ S });
    assert.equal(snapshot.coneOk, false, `snapshot rejects invalid S=${String(S)}`);
    const result = authorizeWithCone({
      S,
      env: { ACCEPT_LOCAL_EVIDENCE: '1' },
      config: {},
      requireCone: true,
    });
    assert.equal(result.authorized, false, `authorization rejects invalid S=${String(S)}`);
    assert.equal(result.residualCoordinateValid, false);
  }

  const lower = authorizeWithCone({ S: 0, env: { ACCEPT_LOCAL_EVIDENCE: '1' }, requireCone: true });
  const upper = authorizeWithCone({ S: 0.25, env: { ACCEPT_LOCAL_EVIDENCE: '1' }, requireCone: true });
  assert.equal(lower.authorized, true);
  assert.equal(upper.authorized, true);

  const coneDisabledStillRejectsInvalidDomain = authorizeWithCone({
    S: 100,
    env: { ACCEPT_LOCAL_EVIDENCE: '1' },
    requireCone: false,
  });
  assert.equal(coneDisabledStillRejectsInvalidDomain.authorized, false);
}

console.log('evidence-status-document.test.mjs: 8/8 groups passed');
