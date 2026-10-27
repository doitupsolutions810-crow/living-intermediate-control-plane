import { createHash, createPublicKey, verify } from 'node:crypto';

export const SOURCE_IDENTITY = 'control12-evidence-console';
export const EVIDENCE_CONTRACT = Object.freeze({
  version: '5.4.0',
  runtime: 'read-only-dynamic',
  privacy: 'local-only',
  serverSideEvidenceStorage: false,
  syntheticEvidenceRejected: true,
  productionEvidenceClassRequired: true,
  requiredEvidenceClass: 'production-acceptance',
  requiredEnvironment: 'production',
  mandatoryGates: 7,
});
export const CHECK_IDS = Object.freeze(['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6']);
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 30 * 1000;

export function canonicalSourceJson(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(item => item === undefined ? 'null' : canonicalSourceJson(item)).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonicalSourceJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function sourceSha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function verifyProducerEvidenceContract(status, schema, {
  publicKeyPem = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM || '',
  keyId = process.env.EVIDENCE_SOURCE_KEY_ID || '',
  now = Date.now(),
} = {}) {
  const failures = [];
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    return { valid: false, failures: ['status_not_object'] };
  }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { valid: false, failures: ['schema_not_object'] };
  }

  const expectedFields = [
    ...Object.keys(EVIDENCE_CONTRACT), 'sourceIdentity', 'sourceKeyId', 'sourceSchemaDigest',
    'sourceEvidenceDigest', 'sourceSignature', 'sourceGeneratedAt', 'sourceExpiresAt', 'overall', 'gates',
  ].sort();
  if (Object.keys(status).sort().join('|') !== expectedFields.join('|')) failures.push('status_fields_not_exact');

  for (const [field, expected] of Object.entries(EVIDENCE_CONTRACT)) {
    if (status[field] !== expected) failures.push('status_contract_field_mismatch:' + field);
  }
  if (status.overall !== 'READY') failures.push('status_overall_not_ready');
  if (status.sourceIdentity !== SOURCE_IDENTITY) failures.push('source_identity_mismatch');
  if (!keyId || status.sourceKeyId !== keyId) failures.push('source_key_id_mismatch');

  const gates = Array.isArray(status.gates) ? status.gates : [];
  const gateIds = gates.map(g => g?.id);
  if (gates.length !== CHECK_IDS.length ||
      new Set(gateIds).size !== CHECK_IDS.length ||
      !CHECK_IDS.every(id => gateIds.includes(id)) ||
      gates.some(g => !g || typeof g !== 'object' || Array.isArray(g) ||
        Object.keys(g).sort().join('|') !== 'id|status' || g.status !== 'READY')) {
    failures.push('status_contract_check_gates_invalid');
  }

  const generated = Date.parse(status.sourceGeneratedAt);
  const expires = Date.parse(status.sourceExpiresAt);
  if (!Number.isFinite(generated) || !Number.isFinite(expires)) {
    failures.push('freshness_timestamps_invalid');
  } else {
    if (generated > now + MAX_CLOCK_SKEW_MS) failures.push('source_generated_in_future');
    if (now - generated > MAX_AGE_MS) failures.push('source_evidence_stale');
    if (expires <= now) failures.push('source_evidence_expired');
    if (expires <= generated || expires - generated > MAX_AGE_MS) failures.push('source_lifetime_invalid');
  }

  const schemaProperties = schema.properties;
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
      schema.type !== 'object' || schema.additionalProperties !== false ||
      !schemaProperties || typeof schemaProperties !== 'object' || Array.isArray(schemaProperties)) {
    failures.push('source_schema_root_invalid');
  } else {
    for (const [field, expected] of Object.entries(EVIDENCE_CONTRACT)) {
      if (schemaProperties[field]?.const !== expected) failures.push('source_schema_contract_mismatch:' + field);
    }
    if (schemaProperties.sourceIdentity?.const !== SOURCE_IDENTITY) failures.push('source_schema_identity_mismatch');
    if (schemaProperties.sourceKeyId?.const !== keyId) failures.push('source_schema_key_id_mismatch');
    const schemaGates = schemaProperties.gates;
    if (schemaGates?.items?.additionalProperties !== false ||
        schemaGates?.items?.properties?.status?.const !== 'READY' ||
        schemaGates?.items?.properties?.id?.enum?.join('|') !== CHECK_IDS.join('|') ||
        schemaGates.minItems !== 7 || schemaGates.maxItems !== 7) {
      failures.push('source_schema_gate_contract_invalid');
    }
    const schemaDigest = sourceSha256(canonicalSourceJson(schema));
    if (status.sourceSchemaDigest !== schemaDigest) failures.push('source_schema_digest_mismatch');
  }

  const unsigned = { ...status };
  delete unsigned.sourceEvidenceDigest;
  delete unsigned.sourceSignature;
  const expectedDigest = sourceSha256(canonicalSourceJson(unsigned));
  if (status.sourceEvidenceDigest !== expectedDigest) failures.push('source_digest_mismatch');

  if (!publicKeyPem || !keyId) {
    failures.push('pinned_public_key_not_configured');
  } else if (typeof status.sourceSignature !== 'string' ||
      !/^[A-Za-z0-9+/]{86}==$/.test(status.sourceSignature)) {
    failures.push('source_signature_malformed');
  } else if (status.sourceEvidenceDigest === expectedDigest) {
    try {
      const key = createPublicKey(publicKeyPem);
      if (key.asymmetricKeyType !== 'ed25519') {
        failures.push('source_public_key_type_invalid');
      } else {
        const message = [
          status.sourceIdentity, status.sourceKeyId, status.sourceGeneratedAt,
          status.sourceExpiresAt, status.sourceEvidenceDigest,
        ].join('\\n');
        const signature = Buffer.from(status.sourceSignature, 'base64');
        if (signature.toString('base64') !== status.sourceSignature ||
            !verify(null, Buffer.from(message, 'utf8'), key, signature)) {
          failures.push('source_signature_invalid');
        }
      }
    } catch {
      failures.push('source_public_key_or_signature_invalid');
    }
  }

  return { valid: failures.length === 0, failures };
}
