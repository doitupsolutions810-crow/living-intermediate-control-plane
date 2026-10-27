import { createHash, createPublicKey, verify } from 'node:crypto';
import { coneCompliant } from './great-scale-residual.mjs';

export const PRODUCTION_ACCEPTANCE_SCHEMA = 'great-scale.production-acceptance/v1';
export const PRODUCTION_ACCEPTANCE_ISSUER = 'living-intermediate-control-plane-production-acceptance';
export const PRODUCTION_GATE_IDS = Object.freeze(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 30 * 1000;

export function canonicalAcceptanceJson(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(item => canonicalAcceptanceJson(item)).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + canonicalAcceptanceJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256Hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Verify a distinct G0-G6 production acceptance attestation.
 * The caller must configure a trusted public key, expected key id, and expected build id
 * through deployment-controlled environment variables. No caller-supplied boolean is trusted.
 */
export function verifyProductionAcceptanceAttestation(attestation, {
  publicKeyPem = process.env.PRODUCTION_ACCEPTANCE_PUBLIC_KEY_PEM || '',
  keyId = process.env.PRODUCTION_ACCEPTANCE_KEY_ID || '',
  buildId = process.env.PRODUCTION_ACCEPTANCE_BUILD_ID || '',
  residualSourceId = process.env.PRODUCTION_ACCEPTANCE_RESIDUAL_SOURCE_ID || '',
  environment = 'production',
  now = Date.now(),
} = {}) {
  const failures = [];
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) {
    return { valid: false, failures: ['attestation_missing_or_not_object'] };
  }

  const fields = ['schema', 'issuer', 'keyId', 'environment', 'buildId',
    'generatedAt', 'expiresAt', 'gates', 'residual', 'digest', 'signature'].sort();
  if (Object.keys(attestation).sort().join('|') !== fields.join('|')) {
    failures.push('attestation_fields_not_exact');
  }
  if (attestation.schema !== PRODUCTION_ACCEPTANCE_SCHEMA) failures.push('schema_mismatch');
  if (attestation.issuer !== PRODUCTION_ACCEPTANCE_ISSUER) failures.push('issuer_mismatch');
  if (!keyId || attestation.keyId !== keyId) failures.push('key_id_mismatch');
  if (!buildId || attestation.buildId !== buildId) failures.push('build_id_mismatch');
  if (attestation.environment !== environment || environment !== 'production') failures.push('environment_mismatch');

  const gates = Array.isArray(attestation.gates) ? attestation.gates : [];
  const ids = gates.map(g => g?.id);
  if (gates.length !== PRODUCTION_GATE_IDS.length ||
      new Set(ids).size !== PRODUCTION_GATE_IDS.length ||
      !PRODUCTION_GATE_IDS.every(id => ids.includes(id)) ||
      gates.some(g => !g || typeof g !== 'object' || Array.isArray(g) ||
        Object.keys(g).sort().join('|') !== 'id|status' || g.status !== 'PASS')) {
    failures.push('production_gates_incomplete_or_not_passing');
  }

  // A default S=0 is not a measurement. Require a signed, build-bound, fresh
  // residual observation from a deployment-pinned source; the artifact signature
  // covers this object together with the G0-G6 gate results.
  const residual = attestation.residual;
  if (!residual || typeof residual !== 'object' || Array.isArray(residual) ||
      Object.keys(residual).sort().join('|') !== 'buildId|measuredAt|S|schema|sourceId') {
    failures.push('residual_measurement_missing_or_malformed');
  } else {
    const measuredAt = Date.parse(residual.measuredAt);
    if (residual.schema !== 'great-scale.residual-attestation/v1') failures.push('residual_schema_mismatch');
    if (!residualSourceId || residual.sourceId !== residualSourceId) failures.push('residual_source_id_mismatch');
    if (residual.buildId !== buildId || residual.buildId !== attestation.buildId) failures.push('residual_build_id_mismatch');
    if (typeof residual.S !== 'number' || !Number.isFinite(residual.S)) failures.push('residual_value_invalid');
    else if (!coneCompliant(residual.S)) failures.push('residual_cone_violation');
    if (!Number.isFinite(measuredAt)) failures.push('residual_timestamp_invalid');
    else {
      if (measuredAt > now + MAX_CLOCK_SKEW_MS) failures.push('residual_measured_at_in_future');
      if (now - measuredAt > MAX_AGE_MS) failures.push('residual_measurement_stale');
    }
  }

  const generated = Date.parse(attestation.generatedAt);
  const expires = Date.parse(attestation.expiresAt);
  if (!Number.isFinite(generated) || !Number.isFinite(expires)) {
    failures.push('timestamps_invalid');
  } else {
    if (generated > now + MAX_CLOCK_SKEW_MS) failures.push('generated_at_in_future');
    if (now - generated > MAX_AGE_MS) failures.push('attestation_stale');
    if (expires <= now) failures.push('attestation_expired');
    if (expires <= generated || expires - generated > MAX_AGE_MS) failures.push('attestation_lifetime_invalid');
  }

  const { digest, signature, ...body } = attestation;
  const payload = canonicalAcceptanceJson(body);
  const expectedDigest = sha256Hex(payload);
  if (digest !== expectedDigest) failures.push('digest_mismatch');

  if (!publicKeyPem || !keyId || !buildId || !residualSourceId) {
    failures.push('trusted_verification_configuration_missing');
  } else if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) {
    failures.push('signature_malformed');
  } else if (digest === expectedDigest) {
    try {
      const key = createPublicKey(publicKeyPem);
      const raw = Buffer.from(signature, 'base64');
      if (key.asymmetricKeyType !== 'ed25519') failures.push('public_key_type_invalid');
      else if (raw.toString('base64') !== signature ||
        !verify(null, Buffer.from(payload, 'utf8'), key, raw)) failures.push('signature_invalid');
    } catch {
      failures.push('public_key_or_signature_invalid');
    }
  }

  return { valid: failures.length === 0, failures, schema: PRODUCTION_ACCEPTANCE_SCHEMA, residual: failures.length === 0 ? { ...attestation.residual } : null };
}
