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

const SOURCE_TIMESTAMP_PATTERN = /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:[.][0-9]{1,3})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/;

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === expected.length &&
    expected.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function hasExactOrderedValues(value, expected) {
  return Array.isArray(value) && value.length === expected.length &&
    expected.every((item, index) => value[index] === item);
}

function parseSourceTimestamp(value) {
  if (typeof value !== 'string' || !SOURCE_TIMESTAMP_PATTERN.test(value)) return NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return NaN;
  const datePart = value.slice(0, 10);
  const day = Date.parse(datePart + 'T00:00:00Z');
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== datePart) return NaN;
  return parsed;
}

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

  const generated = parseSourceTimestamp(status.sourceGeneratedAt);
  const expires = parseSourceTimestamp(status.sourceExpiresAt);
  if (!Number.isFinite(generated) || !Number.isFinite(expires)) {
    failures.push('freshness_timestamps_invalid');
  } else {
    if (generated > now + MAX_CLOCK_SKEW_MS) failures.push('source_generated_in_future');
    if (now - generated > MAX_AGE_MS) failures.push('source_evidence_stale');
    if (expires <= now) failures.push('source_evidence_expired');
    if (expires <= generated || expires - generated > MAX_AGE_MS) failures.push('source_lifetime_invalid');
  }

  // The schema is signed by the producer, but signature alone does not prove that
  // it enforces this consumer's contract. Independently validate the exact shape.
  const schemaFields = [
    ...Object.keys(EVIDENCE_CONTRACT), 'sourceIdentity', 'sourceKeyId', 'sourceSchemaDigest',
    'sourceEvidenceDigest', 'sourceSignature', 'sourceGeneratedAt', 'sourceExpiresAt', 'overall', 'gates',
  ];
  if (!hasExactKeys(schema, ['$schema', 'type', 'additionalProperties', 'required', 'properties']) ||
      schema.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
      schema.type !== 'object' || schema.additionalProperties !== false) {
    failures.push('source_schema_root_invalid');
  } else {
    const schemaProperties = schema.properties;
    if (!hasExactKeys(schemaProperties, schemaFields)) {
      failures.push('source_schema_properties_not_exact');
    }
    const requiredSet = new Set(Array.isArray(schema.required) ? schema.required : []);
    if (!Array.isArray(schema.required) ||
        schema.required.length !== schemaFields.length ||
        requiredSet.size !== schemaFields.length ||
        !schemaFields.every(field => requiredSet.has(field))) {
      failures.push('source_schema_required_fields_invalid');
    }

    for (const [field, expected] of Object.entries(EVIDENCE_CONTRACT)) {
      if (!hasExactKeys(schemaProperties?.[field], ['const']) || schemaProperties[field].const !== expected) {
        failures.push('source_schema_contract_mismatch:' + field);
      }
    }
    if (!hasExactKeys(schemaProperties?.sourceIdentity, ['const']) ||
        schemaProperties.sourceIdentity.const !== SOURCE_IDENTITY) {
      failures.push('source_schema_identity_mismatch');
    }
    if (!hasExactKeys(schemaProperties?.sourceKeyId, ['const']) || schemaProperties.sourceKeyId.const !== keyId) {
      failures.push('source_schema_key_id_mismatch');
    }
    if (!hasExactKeys(schemaProperties?.sourceSchemaDigest, ['type', 'pattern']) ||
        schemaProperties.sourceSchemaDigest.type !== 'string' ||
        schemaProperties.sourceSchemaDigest.pattern !== '^[a-f0-9]{64}  const unsigned = { ...status };
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
        ].join('\n');
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
) {
      failures.push('source_schema_schema_digest_rule_invalid');
    }
    if (!hasExactKeys(schemaProperties?.sourceEvidenceDigest, ['type', 'pattern']) ||
        schemaProperties.sourceEvidenceDigest.type !== 'string' ||
        schemaProperties.sourceEvidenceDigest.pattern !== '^[a-f0-9]{64}  const unsigned = { ...status };
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
        ].join('\n');
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
) {
      failures.push('source_schema_digest_rule_invalid');
    }
    if (!hasExactKeys(schemaProperties?.sourceSignature, ['type', 'pattern']) ||
        schemaProperties.sourceSignature.type !== 'string' ||
        schemaProperties.sourceSignature.pattern !== '^[A-Za-z0-9+/]{86}==  const unsigned = { ...status };
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
        ].join('\n');
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
) {
      failures.push('source_schema_signature_rule_invalid');
    }
    for (const field of ['sourceGeneratedAt', 'sourceExpiresAt']) {
      if (!hasExactKeys(schemaProperties?.[field], ['type', 'format']) ||
          schemaProperties[field].type !== 'string' || schemaProperties[field].format !== 'date-time') {
        failures.push('source_schema_timestamp_rule_invalid:' + field);
      }
    }
    if (!hasExactKeys(schemaProperties?.overall, ['const']) || schemaProperties.overall.const !== 'READY') {
      failures.push('source_schema_overall_rule_invalid');
    }

    const schemaGates = schemaProperties?.gates;
    const schemaGateRules = Array.isArray(schemaGates?.allOf) ? schemaGates.allOf : [];
    const gateRuleIds = schemaGateRules.map(rule => rule?.contains?.properties?.id?.const);
    const gateItems = schemaGates?.items;
    const gateItemProperties = gateItems?.properties;
    const gateRulesValid = schemaGateRules.length === CHECK_IDS.length &&
      new Set(gateRuleIds).size === CHECK_IDS.length &&
      CHECK_IDS.every(id => gateRuleIds.includes(id)) &&
      schemaGateRules.every(rule =>
        hasExactKeys(rule, ['contains', 'minContains', 'maxContains']) &&
        rule.minContains === 1 && rule.maxContains === 1 &&
        hasExactKeys(rule.contains, ['type', 'required', 'properties']) &&
        rule.contains.type === 'object' &&
        hasExactOrderedValues(rule.contains.required, ['id']) &&
        hasExactKeys(rule.contains.properties, ['id']) &&
        hasExactKeys(rule.contains.properties.id, ['const']) &&
        CHECK_IDS.includes(rule.contains.properties.id.const));
    const gateItemsValid = hasExactKeys(gateItems, ['type', 'additionalProperties', 'required', 'properties']) &&
      gateItems.type === 'object' && gateItems.additionalProperties === false &&
      hasExactOrderedValues(gateItems.required, ['id', 'status']) &&
      hasExactKeys(gateItemProperties, ['id', 'status']) &&
      hasExactKeys(gateItemProperties.id, ['enum']) &&
      hasExactOrderedValues(gateItemProperties.id.enum, CHECK_IDS) &&
      hasExactKeys(gateItemProperties.status, ['const']) &&
      gateItemProperties.status.const === 'READY';
    if (!hasExactKeys(schemaGates, ['type', 'minItems', 'maxItems', 'uniqueItems', 'allOf', 'items']) ||
        schemaGates.type !== 'array' || schemaGates.minItems !== CHECK_IDS.length ||
        schemaGates.maxItems !== CHECK_IDS.length || schemaGates.uniqueItems !== true ||
        !gateItemsValid || !gateRulesValid) {
      failures.push('source_schema_gate_contract_invalid');
    }
  }
  const schemaDigest = sourceSha256(canonicalSourceJson(schema));
  if (status.sourceSchemaDigest !== schemaDigest) failures.push('source_schema_digest_mismatch');

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
        ].join('\n');
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
