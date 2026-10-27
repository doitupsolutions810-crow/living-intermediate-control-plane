/**
 * Verify a provenance-bound Great Scale measurement attestation.
 *
 * Trust requires a pinned public key/key id AND caller-supplied expected identity
 * bindings. A boolean supplied by an upstream caller is never sufficient.
 */
import { createPublicKey, verify } from 'node:crypto';

const SCHEMA = 'control-plane.measurement-attestation/v1';
const SHA256 = /^(?:sha256:)?[a-f0-9]{64}$/i;
const MAX_ATTESTATION_LIFETIME_MS = 10 * 60 * 1000;

export function canonicalAttestationJson(value) {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((out, key) => {
        out[key] = v[key];
        return out;
      }, {});
    }
    return v;
  });
}

export function verifyMeasurementAttestation(attestation, {
  publicKeyPem = process.env.MEASUREMENT_ATTESTATION_PUBLIC_KEY_PEM || '',
  keyId = process.env.MEASUREMENT_ATTESTATION_KEY_ID || '',
  expected = {},
  now = Date.now(),
} = {}) {
  const failures = [];
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) {
    return { valid: false, failures: [{ code: 'SHAPE', detail: 'attestation must be an object' }] };
  }

  if (attestation.schema !== SCHEMA) failures.push({ code: 'SCHEMA', detail: 'wrong attestation schema' });
  if (!publicKeyPem || !keyId) failures.push({ code: 'TRUST_ANCHOR', detail: 'pinned public key and key id are required' });
  if (attestation.keyId !== keyId) failures.push({ code: 'KEY_ID', detail: 'attestation key id does not match pinned key id' });

  for (const field of ['issuer', 'repository', 'commitSha', 'runId', 'artifactDigest']) {
    if (typeof expected[field] !== 'string' || !expected[field].trim()) {
      failures.push({ code: 'EXPECTED_BINDING', detail: `expected ${field} binding is required` });
    } else if (attestation[field] !== expected[field]) {
      failures.push({ code: 'BINDING_MISMATCH', detail: `${field} does not match expected identity` });
    }
  }

  if (!Number.isFinite(expected.residualS) || attestation.residualS !== expected.residualS) {
    failures.push({ code: 'BINDING_MISMATCH', detail: 'residualS does not match the residual being authorized' });
  }

  if (typeof attestation.artifactDigest !== 'string' || !SHA256.test(attestation.artifactDigest)) {
    failures.push({ code: 'ARTIFACT_DIGEST', detail: 'artifactDigest must be a SHA-256 digest' });
  }
  if (!Number.isFinite(attestation.residualS) || attestation.residualS < 0 || attestation.residualS > 0.25) {
    failures.push({ code: 'RESIDUAL', detail: 'residualS must be finite and in [0, 0.25]' });
  }

  const measuredAt = Date.parse(attestation.measuredAt);
  const expiresAt = Date.parse(attestation.expiresAt);
  if (!Number.isFinite(measuredAt) || !Number.isFinite(expiresAt)) {
    failures.push({ code: 'FRESHNESS', detail: 'measuredAt/expiresAt must be valid timestamps' });
  } else {
    if (measuredAt > now + 5000) failures.push({ code: 'FRESHNESS', detail: 'measurement timestamp is in the future' });
    if (expiresAt <= now) failures.push({ code: 'FRESHNESS', detail: 'measurement attestation expired' });
    if (expiresAt <= measuredAt) failures.push({ code: 'FRESHNESS', detail: 'expiry must be after measurement time' });
    if (expiresAt > measuredAt && expiresAt - measuredAt > MAX_ATTESTATION_LIFETIME_MS) failures.push({ code: 'FRESHNESS', detail: 'attestation lifetime exceeds 10-minute maximum' });
  }

  const { signature, ...payload } = attestation;
  if (typeof signature !== 'string' || !signature) {
    failures.push({ code: 'SIGNATURE', detail: 'signature is required' });
  } else if (publicKeyPem && keyId && attestation.keyId === keyId) {
    try {
      const publicKey = createPublicKey(publicKeyPem);
      const signatureOk = verify(null, Buffer.from(canonicalAttestationJson(payload), 'utf8'), publicKey, Buffer.from(signature, 'base64'));
      if (!signatureOk) failures.push({ code: 'SIGNATURE', detail: 'signature verification failed' });
    } catch {
      failures.push({ code: 'SIGNATURE', detail: 'public key or signature is invalid' });
    }
  }

  return {
    valid: failures.length === 0,
    failures,
    schema: attestation.schema ?? null,
    issuer: attestation.issuer ?? null,
    repository: attestation.repository ?? null,
    commitSha: attestation.commitSha ?? null,
    runId: attestation.runId ?? null,
    artifactDigest: attestation.artifactDigest ?? null,
    residualS: attestation.residualS ?? null,
  };
}
