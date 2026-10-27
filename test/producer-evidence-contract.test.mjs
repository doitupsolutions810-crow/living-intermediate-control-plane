import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  CHECK_IDS,
  EVIDENCE_CONTRACT,
  canonicalSourceJson,
  verifyProducerEvidenceContract,
} from '../lib/producer-evidence-contract.mjs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
const keyId = 'test-ed25519-key';
const now = Date.now();

function sha(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function resign(status, schema) {
  status.sourceSchemaDigest = sha(canonicalSourceJson(schema));
  delete status.sourceEvidenceDigest;
  delete status.sourceSignature;
  status.sourceEvidenceDigest = sha(canonicalSourceJson(status));
  const message = [
    status.sourceIdentity, status.sourceKeyId, status.sourceGeneratedAt,
    status.sourceExpiresAt, status.sourceEvidenceDigest,
  ].join('\n');
  status.sourceSignature = sign(null, Buffer.from(message), privateKey).toString('base64');
}

function fixture(at = now) {
  const properties = Object.fromEntries(Object.entries(EVIDENCE_CONTRACT).map(([key, value]) => [key, { const: value }]));
  Object.assign(properties, {
    sourceIdentity: { const: 'control12-evidence-console' },
    sourceKeyId: { const: keyId },
    sourceSchemaDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    sourceEvidenceDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    sourceSignature: { type: 'string', pattern: '^[A-Za-z0-9+/]{86}==$' },
    sourceGeneratedAt: { type: 'string', format: 'date-time' },
    sourceExpiresAt: { type: 'string', format: 'date-time' },
    overall: { const: 'READY' },
    gates: {
      type: 'array', minItems: 7, maxItems: 7, uniqueItems: true,
      allOf: CHECK_IDS.map(id => ({
        contains: { type: 'object', required: ['id'], properties: { id: { const: id } } },
        minContains: 1, maxContains: 1,
      })),
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'status'],
        properties: { id: { enum: [...CHECK_IDS] }, status: { const: 'READY' } },
      },
    },
  });
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: [...Object.keys(EVIDENCE_CONTRACT), 'sourceIdentity', 'sourceKeyId', 'sourceSchemaDigest',
      'sourceEvidenceDigest', 'sourceSignature', 'sourceGeneratedAt', 'sourceExpiresAt', 'overall', 'gates'],
    properties,
  };
  const status = {
    ...EVIDENCE_CONTRACT,
    sourceIdentity: 'control12-evidence-console',
    sourceKeyId: keyId,
    sourceSchemaDigest: sha(canonicalSourceJson(schema)),
    sourceGeneratedAt: new Date(at).toISOString(),
    sourceExpiresAt: new Date(at + 60_000).toISOString(),
    overall: 'READY',
    gates: CHECK_IDS.map(id => ({ id, status: 'READY' })),
  };
  status.sourceEvidenceDigest = sha(canonicalSourceJson(status));
  // The producer digest omits sourceEvidenceDigest and sourceSignature.
  const unsigned = { ...status };
  delete unsigned.sourceEvidenceDigest;
  status.sourceEvidenceDigest = sha(canonicalSourceJson(unsigned));
  const message = [
    status.sourceIdentity, status.sourceKeyId, status.sourceGeneratedAt,
    status.sourceExpiresAt, status.sourceEvidenceDigest,
  ].join('\n');
  status.sourceSignature = sign(null, Buffer.from(message), privateKey).toString('base64');
  return { status, schema };
}

test('accepts a fresh signed producer status bound to its schema', () => {
  const { status, schema } = fixture();
  assert.deepEqual(verifyProducerEvidenceContract(status, schema, { publicKeyPem, keyId, now }), {
    valid: true, failures: [],
  });
});

test('rejects schema tampering even when status signature is otherwise valid', () => {
  const { status, schema } = fixture();
  schema.properties.runtime.const = 'unreviewed';
  const result = verifyProducerEvidenceContract(status, schema, { publicKeyPem, keyId, now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('source_schema_digest_mismatch'));
});

test('rejects status tampering', () => {
  const { status, schema } = fixture();
  status.overall = 'HOLD';
  const result = verifyProducerEvidenceContract(status, schema, { publicKeyPem, keyId, now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_overall_not_ready'));
  assert.ok(result.failures.includes('source_digest_mismatch'));
});

test('rejects stale signed evidence', () => {
  const { status, schema } = fixture(now - 6 * 60 * 1000);
  const result = verifyProducerEvidenceContract(status, schema, { publicKeyPem, keyId, now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('source_evidence_stale'));
  assert.ok(result.failures.includes('source_evidence_expired'));
});

test('rejects missing independently pinned key configuration', () => {
  const { status, schema } = fixture();
  const result = verifyProducerEvidenceContract(status, schema, { publicKeyPem: '', keyId, now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('pinned_public_key_not_configured'));
});

test('rejects weakened required-field schema even when it is re-digested and correctly signed', () => {
  const { status, schema } = fixture();
  schema.required = schema.required.filter(field => field !== 'gates');
  resign(status, schema);
  const result = verifyProducerEvidenceContract(status, schema, { publicKeyPem, keyId, now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('source_schema_required_fields_invalid'));
});

test('rejects schema without exact once-per-gate coverage even when correctly signed', () => {
  const { status, schema } = fixture();
  schema.properties.gates.allOf = schema.properties.gates.allOf.slice(1);
  resign(status, schema);
  const result = verifyProducerEvidenceContract(status, schema, { publicKeyPem, keyId, now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('source_schema_gate_contract_invalid'));
});

test('rejects schema permitting duplicate gate entries even when correctly signed', () => {
  const { status, schema } = fixture();
  schema.properties.gates.uniqueItems = false;
  resign(status, schema);
  const result = verifyProducerEvidenceContract(status, schema, { publicKeyPem, keyId, now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('source_schema_gate_contract_invalid'));
});

test('rejects invalid calendar timestamps rather than accepting Date.parse normalization', () => {
  const { status, schema } = fixture();
  status.sourceGeneratedAt = '2026-02-30T12:00:00.000Z';
  resign(status, schema);
  const result = verifyProducerEvidenceContract(status, schema, { publicKeyPem, keyId, now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('freshness_timestamps_invalid'));
});
