import { createHash, verify } from 'node:crypto';

const SOURCE_IDENTITY = 'control12-evidence-console';
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9+/]{86}==$/;

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(item => item === undefined ? 'null' : canonicalJson(item)).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function digestStatus(status) {
  const unsigned = { ...status };
  delete unsigned.sourceEvidenceDigest;
  delete unsigned.sourceSignature;
  return createHash('sha256').update(canonicalJson(unsigned)).digest('hex');
}

function signatureMessage(status) {
  return [
    status.sourceIdentity,
    status.sourceKeyId,
    status.sourceGeneratedAt,
    status.sourceExpiresAt,
    status.sourceEvidenceDigest
  ].join('\n');
}

/**
 * Verify source authenticity and schema binding using an independently pinned
 * public key. This function does not establish production readiness.
 */
export function verifySignedEvidenceSource(status, schema, { env = process.env } = {}) {
  const failures = [];
  const expectedKeyId = typeof env.EVIDENCE_SOURCE_KEY_ID === 'string'
    ? env.EVIDENCE_SOURCE_KEY_ID.trim() : '';
  const publicKeyPem = typeof env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM === 'string'
    ? env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM.trim() : '';

  if (!expectedKeyId || !publicKeyPem) {
    return { valid: false, failures: ['source_trust_anchor_unconfigured'] };
  }
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    return { valid: false, failures: ['source_status_not_object'] };
  }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    failures.push('source_schema_not_object');
  } else {
    const schemaDigest = createHash('sha256').update(canonicalJson(schema)).digest('hex');
    if (typeof status.sourceSchemaDigest !== 'string' || !DIGEST_PATTERN.test(status.sourceSchemaDigest)) {
      failures.push('source_schema_digest_malformed');
    } else if (status.sourceSchemaDigest !== schemaDigest) {
      failures.push('source_schema_digest_mismatch');
    }
  }

  if (status.sourceIdentity !== SOURCE_IDENTITY) failures.push('source_identity_mismatch');
  if (status.sourceKeyId !== expectedKeyId) failures.push('source_key_id_mismatch');

  if (typeof status.sourceEvidenceDigest !== 'string' || !DIGEST_PATTERN.test(status.sourceEvidenceDigest)) {
    failures.push('source_digest_malformed');
  } else if (status.sourceEvidenceDigest !== digestStatus(status)) {
    failures.push('source_digest_mismatch');
  }

  if (typeof status.sourceSignature !== 'string' || !SIGNATURE_PATTERN.test(status.sourceSignature)) {
    failures.push('source_signature_malformed');
  } else if (status.sourceEvidenceDigest === digestStatus(status)) {
    try {
      const signature = Buffer.from(status.sourceSignature, 'base64');
      if (signature.toString('base64') !== status.sourceSignature ||
          !verify(null, Buffer.from(signatureMessage(status)), publicKeyPem, signature)) {
        failures.push('source_signature_invalid');
      }
    } catch {
      failures.push('source_signature_invalid');
    }
  }

  const properties = schema && typeof schema === 'object' ? schema.properties : null;
  const required = schema && Array.isArray(schema.required) ? schema.required : [];
  for (const [field, expected] of [
    ['sourceIdentity', SOURCE_IDENTITY],
    ['sourceKeyId', expectedKeyId]
  ]) {
    if (!required.includes(field) || properties?.[field]?.const !== expected) {
      failures.push('schema_' + field + '_constraint_mismatch');
    }
  }
  if (!required.includes('sourceSchemaDigest') ||
      properties?.sourceSchemaDigest?.type !== 'string' ||
      properties?.sourceSchemaDigest?.pattern !== '^[a-f0-9]{64}$') {
    failures.push('schema_source_schema_digest_constraint_mismatch');
  }
  if (!required.includes('sourceEvidenceDigest') ||
      properties?.sourceEvidenceDigest?.type !== 'string' ||
      properties?.sourceEvidenceDigest?.pattern !== '^[a-f0-9]{64}$') {
    failures.push('schema_source_digest_constraint_mismatch');
  }
  if (!required.includes('sourceSignature') ||
      properties?.sourceSignature?.type !== 'string' ||
      properties?.sourceSignature?.pattern !== '^[A-Za-z0-9+/]{86}==$') {
    failures.push('schema_source_signature_constraint_mismatch');
  }

  return { valid: failures.length === 0, failures };
}
