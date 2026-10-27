/** Residual-aware evidence status document — focused unit checks */
import { generateKeyPairSync } from 'node:crypto';
import { strict as assert } from 'node:assert';
import {
  buildEvidenceStatusDocument,
  sealEvidenceStatusDocument,
  verifyEvidenceStatusDocument,
} from '../lib/evidence-status-document.mjs';

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

console.log('evidence-status-document.test.mjs: 5/5 passed');
