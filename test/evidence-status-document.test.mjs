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

// 9. Invalid topology saturation is not clamped into a valid evidence sample.
{
  for (const tau of [-0.01, 1.01, 2, Infinity, NaN, '0.5']) {
    const snapshot = residualSnapshot({ tau });
    assert.equal(snapshot.coneOk, false, `snapshot rejects invalid tau=${String(tau)}`);
    assert.equal(snapshot.S, null, `invalid tau must not synthesize S=${String(tau)}`);
    assert.equal(snapshot.tau, tau, 'retain requested tau for diagnostics');
  }

  const doc = buildEvidenceStatusDocument({ tau: 2 });
  assert.equal(doc.residual.S, null);
  assert.equal(doc.residual.coneOk, false);
  assert.ok(doc.contractChecks.every(check => check.status === 'HOLD'));

  const signed = sealEvidenceStatusDocument(doc, { privateKeyPem: privPem, keyId });
  const result = verifyEvidenceStatusDocument(signed, {
    publicKeyPem: pubPem,
    keyId,
    requireSignature: true,
  });
  assert.equal(result.valid, false, 'signature cannot legitimize an invalid topology input');
  assert.ok(result.failures.some(f => f.code === 'RESIDUAL_DOMAIN'));
}

// 10. The closed signed v5.4.0 document rejects caller-supplied top-level overrides.
{
  const overrides = [
    { authority: 'public' },
    { schema: 'attacker-controlled-schema' },
    { version: '999.0.0' },
    { residual: { S: 0, coneOk: true, sourceId: 'untrusted' } },
    { contractChecks: ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'].map(id => ({ id, status: 'READY' })) },
    { namespaces: { evidence: 'E0-E6', production: 'AUTHORIZED', independent: true } },
    { productionAuthorized: true },
  ];
  for (const extra of overrides) {
    assert.throws(
      () => buildEvidenceStatusDocument({ S: 0.1, extra }),
      /extra is not supported by the closed v5\.4\.0 evidence-status contract/,
      `rejects top-level extension/override: ${Object.keys(extra).join(',')}`,
    );
  }

  const noOverride = buildEvidenceStatusDocument({ S: 0.1, extra: {} });
  assert.equal(noOverride.schema, 'great-scale.evidence-status/v5.4.0');
  assert.equal(noOverride.authority, 'local');
  assert.equal(noOverride.residual.S, 0.1);
  assert.deepEqual(noOverride.namespaces, {
    evidence: 'E0-E6', production: 'G0-G6', independent: true,
  });
}

// 11. The verifier rejects signed documents with forged claims or inconsistent residual math.
{
  const unknownTopLevel = buildEvidenceStatusDocument({ S: 0.1 });
  unknownTopLevel.productionAuthorized = true;
  const signedUnknownTopLevel = sealEvidenceStatusDocument(
    unknownTopLevel, { privateKeyPem: privPem, keyId },
  );
  const unknownTopLevelResult = verifyEvidenceStatusDocument(signedUnknownTopLevel, {
    publicKeyPem: pubPem, keyId, requireSignature: true,
  });
  assert.equal(unknownTopLevelResult.valid, false);
  assert.ok(unknownTopLevelResult.failures.some(f => f.code === 'DOCUMENT_FIELDS'));

  const wrongNamespaces = buildEvidenceStatusDocument({ S: 0.1 });
  wrongNamespaces.namespaces.production = 'AUTHORIZED';
  const signedWrongNamespaces = sealEvidenceStatusDocument(
    wrongNamespaces, { privateKeyPem: privPem, keyId },
  );
  const namespaceResult = verifyEvidenceStatusDocument(signedWrongNamespaces, {
    publicKeyPem: pubPem, keyId, requireSignature: true,
  });
  assert.equal(namespaceResult.valid, false);
  assert.ok(namespaceResult.failures.some(f => f.code === 'NAMESPACE'));

  const wrongGateStatus = buildEvidenceStatusDocument({ S: 0.1 });
  wrongGateStatus.contractChecks[0].status = 'AUTHORIZED';
  const signedWrongGate = sealEvidenceStatusDocument(
    wrongGateStatus, { privateKeyPem: privPem, keyId },
  );
  const gateResult = verifyEvidenceStatusDocument(signedWrongGate, {
    publicKeyPem: pubPem, keyId, requireSignature: true,
  });
  assert.equal(gateResult.valid, false);
  assert.ok(gateResult.failures.some(f => f.code === 'E_GATES'));

  const wrongResidual = buildEvidenceStatusDocument({ S: 0.1 });
  wrongResidual.residual.psi = 999;
  const signedWrongResidual = sealEvidenceStatusDocument(
    wrongResidual, { privateKeyPem: privPem, keyId },
  );
  const residualResult = verifyEvidenceStatusDocument(signedWrongResidual, {
    publicKeyPem: pubPem, keyId, requireSignature: true,
  });
  assert.equal(residualResult.valid, false);
  assert.ok(residualResult.failures.some(f => f.code === 'RESIDUAL_BINDING'));

  const callerNote = buildEvidenceStatusDocument({ S: 0.1 });
  callerNote.note = 'caller-controlled note';
  const signedWithNote = sealEvidenceStatusDocument(
    callerNote, { privateKeyPem: privPem, keyId },
  );
  assert.notEqual(signedWithNote.note, 'caller-controlled note');
  assert.equal(verifyEvidenceStatusDocument(signedWithNote, {
    publicKeyPem: pubPem, keyId, requireSignature: true,
  }).valid, true, 'diagnostic note remains outside the signed payload');
}

// 12. Strict freshness rejects impossible dates, excessive lifetime, and exact-expiry reads.
{
  const badDate = buildEvidenceStatusDocument({ S: 0.1 });
  badDate.generatedAt = '2026-02-30T12:00:00.000Z';
  const signedBadDate = sealEvidenceStatusDocument(badDate, { privateKeyPem: privPem, keyId });
  const dateResult = verifyEvidenceStatusDocument(signedBadDate, {
    publicKeyPem: pubPem, keyId, requireSignature: true,
  });
  assert.equal(dateResult.valid, false);
  assert.ok(dateResult.failures.some(f => f.code === 'FRESHNESS'));

  const excessiveLifetime = buildEvidenceStatusDocument({ S: 0.1 });
  excessiveLifetime.expiresAt = new Date(Date.parse(excessiveLifetime.generatedAt) + 60_001).toISOString();
  const signedLongLived = sealEvidenceStatusDocument(excessiveLifetime, { privateKeyPem: privPem, keyId });
  const lifetimeResult = verifyEvidenceStatusDocument(signedLongLived, {
    publicKeyPem: pubPem, keyId, requireSignature: true,
  });
  assert.equal(lifetimeResult.valid, false);
  assert.ok(lifetimeResult.failures.some(f => f.code === 'FRESHNESS'));

  const wellFormed = sealEvidenceStatusDocument(
    buildEvidenceStatusDocument({ S: 0.1 }), { privateKeyPem: privPem, keyId },
  );
  const expiryInstant = Date.parse(wellFormed.expiresAt);
  const expiryResult = verifyEvidenceStatusDocument(wellFormed, {
    publicKeyPem: pubPem, keyId, now: expiryInstant, requireSignature: true,
  });
  assert.equal(expiryResult.valid, false, 'document is expired at its exact expiresAt time');

  const badClockResult = verifyEvidenceStatusDocument(wellFormed, {
    publicKeyPem: pubPem, keyId, now: Number.NaN, requireSignature: true,
  });
  assert.equal(badClockResult.valid, false);
  assert.ok(badClockResult.failures.some(f => f.code === 'FRESHNESS'));
}

console.log('evidence-status-document.test.mjs: 12/12 groups passed');
