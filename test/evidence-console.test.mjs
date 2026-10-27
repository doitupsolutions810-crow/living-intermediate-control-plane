import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  probeEvidenceConsole,
  validateEvidenceConsoleContract
} from '../lib/evidence-console.mjs';

const expected = {
  version: '5.4.0',
  runtime: 'read-only-dynamic',
  privacy: 'local-only',
  serverSideEvidenceStorage: false,
  syntheticEvidenceRejected: true,
  productionEvidenceClassRequired: true,
  requiredEvidenceClass: 'production-acceptance',
  requiredEnvironment: 'production',
  mandatoryGates: 7
};

const oldKeyId = process.env.EVIDENCE_SOURCE_KEY_ID;
const oldPublicKey = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
const { publicKey: fixturePublicKey, privateKey: fixturePrivateKey } = generateKeyPairSync('ed25519');
const fixturePublicKeyPem = fixturePublicKey.export({ type: 'spki', format: 'pem' });
process.env.EVIDENCE_SOURCE_KEY_ID = 'fixture-key-1';
process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = fixturePublicKeyPem;
test.after(() => {
  if (oldKeyId === undefined) delete process.env.EVIDENCE_SOURCE_KEY_ID;
  else process.env.EVIDENCE_SOURCE_KEY_ID = oldKeyId;
  if (oldPublicKey === undefined) delete process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
  else process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = oldPublicKey;
});

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

function attachSourceSignature(status) {
  delete status.sourceEvidenceDigest;
  delete status.sourceSignature;
  status.sourceEvidenceDigest = createHash('sha256').update(canonicalJson(status)).digest('hex');
  const message = [
    status.sourceIdentity, status.sourceKeyId, status.sourceGeneratedAt,
    status.sourceExpiresAt, status.sourceEvidenceDigest
  ].join('\n');
  status.sourceSignature = sign(null, Buffer.from(message), fixturePrivateKey).toString('base64');
  return status;
}

function goodStatus(overrides = {}) {
  const status = {
    ...expected,
    sourceIdentity: 'control12-evidence-console',
    sourceKeyId: 'fixture-key-1',
    sourceGeneratedAt: new Date().toISOString(),
    sourceExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    overall: 'READY',
    gates: Array.from({ length: 7 }, (_, i) => ({ id: `E${i}`, status: 'READY' })),
    ...overrides
  };
  return attachSourceSignature(status);
}

function constraint(value) {
  return { const: value };
}

function goodSchema(overrides = {}) {
  const properties = {
    version: constraint(expected.version),
    sourceIdentity: constraint('control12-evidence-console'),
    sourceKeyId: constraint('fixture-key-1'),
    sourceEvidenceDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    sourceSignature: { type: 'string', pattern: '^[A-Za-z0-9+/]{86}==$' },
    sourceGeneratedAt: { type: 'string', format: 'date-time' },
    sourceExpiresAt: { type: 'string', format: 'date-time' },
    runtime: constraint(expected.runtime),
    privacy: constraint(expected.privacy),
    serverSideEvidenceStorage: constraint(false),
    syntheticEvidenceRejected: constraint(true),
    productionEvidenceClassRequired: constraint(true),
    requiredEvidenceClass: constraint(expected.requiredEvidenceClass),
    requiredEnvironment: constraint(expected.requiredEnvironment),
    mandatoryGates: constraint(7),
    overall: constraint('READY'),
    gates: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      uniqueItems: true,
      allOf: ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'].map(id => ({
        contains: { type: 'object', required: ['id'], properties: { id: constraint(id) } },
        minContains: 1,
        maxContains: 1
      })),
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'status'],
        properties: {
          id: { enum: ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'] },
          status: constraint('READY')
        }
      }
    }
  };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: [...Object.keys(expected), 'sourceIdentity', 'sourceKeyId', 'sourceEvidenceDigest', 'sourceSignature', 'sourceGeneratedAt', 'sourceExpiresAt', 'overall', 'gates'],
    properties: { ...properties, ...overrides }
  };
}

test('public evidence requires a valid signature bound to the exact status payload', () => {
  const now = Date.now();
  const valid = goodStatus();
  assert.equal(validateEvidenceConsoleContract(valid, goodSchema(), { now }).valid, true);

  const modified = { ...valid, privacy: 'remote-storage' };
  const result = validateEvidenceConsoleContract(modified, goodSchema(), { now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_privacy_mismatch'));
  assert.ok(result.failures.includes('status_source_evidence_digest_mismatch'));
});

test('source signature is required and unknown key configuration fails closed', () => {
  const status = goodStatus();
  delete status.sourceSignature;
  const missingSignature = validateEvidenceConsoleContract(status, goodSchema());
  assert.equal(missingSignature.valid, false);
  assert.ok(missingSignature.failures.includes('status_source_signature_malformed'));

  const savedKey = process.env.EVIDENCE_SOURCE_KEY_ID;
  const savedPem = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
  delete process.env.EVIDENCE_SOURCE_KEY_ID;
  delete process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
  try {
    const unconfigured = validateEvidenceConsoleContract(goodStatus(), goodSchema());
    assert.equal(unconfigured.valid, false);
    assert.ok(unconfigured.failures.includes('source_signature_verification_unconfigured'));
  } finally {
    process.env.EVIDENCE_SOURCE_KEY_ID = savedKey;
    process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = savedPem;
  }
});

test('fresh signed metadata cannot make an expired or stale source claim acceptable', () => {
  const now = Date.now();
  const stale = goodStatus({
    sourceGeneratedAt: new Date(now - 6 * 60_000).toISOString(),
    sourceExpiresAt: new Date(now + 30_000).toISOString()
  });
  const staleResult = validateEvidenceConsoleContract(stale, goodSchema(), { now });
  assert.ok(staleResult.failures.includes('status_source_evidence_stale'));
  assert.equal(staleResult.valid, false);
});

test('schema must independently require source identity, digest, and signature fields', () => {
  const schema = goodSchema();
  schema.required = schema.required.filter(key => key !== 'sourceSignature');
  const result = validateEvidenceConsoleContract(goodStatus(), schema);
  assert.ok(result.failures.includes('schema_required_sourceSignature_missing'));

  const weakened = goodSchema();
  weakened.properties.sourceEvidenceDigest = { type: 'string' };
  const weakenedResult = validateEvidenceConsoleContract(goodStatus(), weakened);
  assert.ok(weakenedResult.failures.includes('schema_sourceEvidenceDigest_constraint_mismatch'));
});

test('status and schema contract verify independently and permit public authority', async () => {
  const status = goodStatus();
  const schema = goodSchema();
  assert.deepEqual(validateEvidenceConsoleContract(status, schema), { valid: true, failures: [] });

  const called = [];
  const result = await probeEvidenceConsole({
    url: 'https://evidence.example.invalid',
    fetchImpl: async url => {
      called.push(String(url));
      if (String(url).endsWith('/api/status')) {
        return new Response(JSON.stringify(status), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (String(url).endsWith('/api/v1/evidence/schema')) {
        return new Response(JSON.stringify(schema), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('missing', { status: 404 });
    }
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.authority, 'public');
  assert.equal(result.trustContractVerified, true);
  assert.deepEqual(called, [
    'https://evidence.example.invalid/api/status',
    'https://evidence.example.invalid/api/v1/evidence/schema'
  ]);
});

test('HTTP 200 without a valid status contract never becomes public authority', async () => {
  const result = await probeEvidenceConsole({
    url: 'https://evidence.example.invalid',
    acceptLocal: true,
    fetchImpl: async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  });
  assert.equal(result.status, 'invalid');
  assert.equal(result.authority, 'local');
  assert.equal(result.trustContractVerified, false);
  assert.ok(result.trustFailures.includes('status_version_mismatch'));
});

test('status and schema cannot borrow missing policy values from one another', () => {
  const status = goodStatus();
  delete status.syntheticEvidenceRejected;
  const schema = goodSchema();
  const result = validateEvidenceConsoleContract(status, schema);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_syntheticEvidenceRejected_mismatch'));
});

test('weakened schema cannot certify seven READY gates', () => {
  const schema = goodSchema({
    gates: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      items: { type: 'object', properties: { status: { type: 'string' } } }
    }
  });
  const result = validateEvidenceConsoleContract(goodStatus(), schema);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('schema_gate_shape_mismatch'));
});

test('a degraded or unavailable status endpoint stays non-public', async () => {
  const result = await probeEvidenceConsole({
    url: 'https://evidence.example.invalid',
    acceptLocal: true,
    fetchImpl: async () => new Response('missing', { status: 404 })
  });
  assert.equal(result.status, 'not_found');
  assert.equal(result.authority, 'local');
  assert.equal(result.trustContractVerified, false);
});

test('public HTTP endpoints are rejected before fetching', async () => {
  let calls = 0;
  const result = await probeEvidenceConsole({
    url: 'http://evidence.example.invalid',
    acceptLocal: true,
    fetchImpl: async () => {
      calls++;
      return new Response('{}', { status: 200 });
    }
  });
  assert.equal(result.status, 'invalid');
  assert.equal(result.trustContractVerified, false);
  assert.equal(calls, 0);
  assert.ok(result.trustFailures.includes('url_invalid'));
});

test('all seven named gates must be present exactly once', () => {
  const status = goodStatus({
    gates: [
      { id: 'E0', status: 'READY' },
      { id: 'E1', status: 'READY' },
      { id: 'E2', status: 'READY' },
      { id: 'E3', status: 'READY' },
      { id: 'E4', status: 'READY' },
      { id: 'E5', status: 'READY' },
      { id: 'E5', status: 'READY' }
    ]
  });
  const result = validateEvidenceConsoleContract(status, goodSchema());
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_gates_not_all_ready_or_incomplete'));
});

test('gate schema must require exactly one occurrence of every E0-E6 ID', () => {
  const schema = goodSchema();
  schema.properties.gates.allOf = schema.properties.gates.allOf.filter(rule =>
    rule.contains.properties.id.const !== 'E6'
  );
  const result = validateEvidenceConsoleContract(goodStatus(), schema);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('schema_gate_shape_mismatch'));
});


test('evidence fetch refuses redirects and disables local HTTP caching', async () => {
  const observed = [];
  await probeEvidenceConsole({
    url: 'https://evidence.example.invalid',
    fetchImpl: async (url, options) => {
      observed.push({ url: String(url), options });
      return String(url).endsWith('/api/status')
        ? new Response(JSON.stringify(goodStatus()), { status: 200 })
        : new Response(JSON.stringify(goodSchema()), { status: 200 });
    }
  });
  assert.equal(observed.length, 2);
  for (const item of observed) {
    assert.equal(item.options.redirect, 'error');
    assert.equal(item.options.cache, 'no-store');
    assert.equal(item.options.headers['cache-control'], 'no-cache');
  }
});

test('cross-origin final response URL never receives public authority', async () => {
  const result = await probeEvidenceConsole({
    url: 'https://evidence.example.invalid',
    acceptLocal: true,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      url: 'https://attacker.example/api/status',
      json: async () => goodStatus()
    })
  });
  assert.equal(result.status, 'unreachable');
  assert.equal(result.authority, 'local');
  assert.equal(result.trustContractVerified, false);
  assert.ok(result.trustFailures.includes('status_endpoint_unreachable'));
});

test('source-generated timestamps reject stale, expired, future, and missing evidence', () => {
  const now = Date.now();
  const schema = goodSchema();

  const stale = goodStatus({
    sourceGeneratedAt: new Date(now - 6 * 60_000).toISOString(),
    sourceExpiresAt: new Date(now + 60_000).toISOString()
  });
  const staleResult = validateEvidenceConsoleContract(stale, schema, { now });
  assert.ok(staleResult.failures.includes('status_source_evidence_stale'));

  const expired = goodStatus({
    sourceGeneratedAt: new Date(now - 60_000).toISOString(),
    sourceExpiresAt: new Date(now - 1).toISOString()
  });
  const expiredResult = validateEvidenceConsoleContract(expired, schema, { now });
  assert.ok(expiredResult.failures.includes('status_source_evidence_expired'));

  const future = goodStatus({
    sourceGeneratedAt: new Date(now + 60_000).toISOString(),
    sourceExpiresAt: new Date(now + 120_000).toISOString()
  });
  const futureResult = validateEvidenceConsoleContract(future, schema, { now });
  assert.ok(futureResult.failures.includes('status_source_generated_at_in_future'));

  const missing = goodStatus({ sourceGeneratedAt: undefined });
  const missingResult = validateEvidenceConsoleContract(missing, schema, { now });
  assert.ok(missingResult.failures.includes('status_source_freshness_timestamps_invalid'));

  const impossibleDate = goodStatus({ sourceGeneratedAt: '2026-02-30T00:00:00Z' });
  const impossibleDateResult = validateEvidenceConsoleContract(impossibleDate, schema, { now });
  assert.ok(impossibleDateResult.failures.includes('status_source_freshness_timestamps_invalid'));
});

test('schema cannot omit or weaken source-freshness constraints', () => {
  const missing = goodSchema();
  missing.required = missing.required.filter(key => key !== 'sourceGeneratedAt');
  const missingResult = validateEvidenceConsoleContract(goodStatus(), missing);
  assert.ok(missingResult.failures.includes('schema_required_sourceGeneratedAt_missing'));

  const weakened = goodSchema();
  weakened.properties.sourceExpiresAt = { type: 'string' };
  const weakenedResult = validateEvidenceConsoleContract(goodStatus(), weakened);
  assert.ok(weakenedResult.failures.includes('schema_sourceExpiresAt_constraint_mismatch'));
});


test('schema values must be exact, not enums that merely include READY', () => {
  const weakPolicy = goodSchema();
  weakPolicy.properties.syntheticEvidenceRejected = { enum: [true, false] };
  const policyResult = validateEvidenceConsoleContract(goodStatus(), weakPolicy);
  assert.equal(policyResult.valid, false);
  assert.ok(policyResult.failures.includes('schema_syntheticEvidenceRejected_constraint_mismatch'));

  const weakOverall = goodSchema();
  weakOverall.properties.overall = { enum: ['READY', 'HOLD'] };
  const overallResult = validateEvidenceConsoleContract(goodStatus(), weakOverall);
  assert.equal(overallResult.valid, false);
  assert.ok(overallResult.failures.includes('schema_overall_constraint_mismatch'));
});

test('schema and status must contain only the exact contract fields', () => {
  const extraSchema = goodSchema();
  extraSchema.properties.operatorNote = { type: 'string' };
  const schemaResult = validateEvidenceConsoleContract(goodStatus(), extraSchema);
  assert.equal(schemaResult.valid, false);
  assert.ok(schemaResult.failures.includes('schema_properties_not_exact'));

  const extraStatus = goodStatus({ operatorNote: 'untrusted addition' });
  const statusResult = validateEvidenceConsoleContract(extraStatus, goodSchema());
  assert.equal(statusResult.valid, false);
  assert.ok(statusResult.failures.includes('status_fields_not_exact'));
});

test('array item schema must reject unrecognized contract-check fields', () => {
  const weakened = goodSchema();
  weakened.properties.gates.items.additionalProperties = true;
  const result = validateEvidenceConsoleContract(goodStatus(), weakened);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('schema_gate_shape_mismatch'));
});

test('contract-check entries cannot carry unrecognized fields', () => {
  const status = goodStatus();
  status.gates[0].unexpected = 'not allowed';
  attachSourceSignature(status);
  const result = validateEvidenceConsoleContract(status, goodSchema());
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_gates_not_all_ready_or_incomplete'));
});

test('gate aliases cannot substitute for the canonical gates field', () => {
  const aliased = { ...goodStatus() };
  aliased.results = aliased.gates;
  delete aliased.gates;
  attachSourceSignature(aliased);
  const result = validateEvidenceConsoleContract(aliased, goodSchema());
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_gates_not_all_ready_or_incomplete'));
  assert.ok(result.failures.includes('status_fields_not_exact'));
});

test('object-form gate map validates only the required E0-E6 properties', () => {
  const gateIds = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
  const status = goodStatus({
    gates: Object.fromEntries(gateIds.map(id => [id, 'READY']))
  });
  const schema = goodSchema();
  schema.properties.gates = {
    type: 'object',
    required: gateIds,
    additionalProperties: false,
    properties: Object.fromEntries(gateIds.map(id => [id, constraint('READY')]))
  };
  assert.deepEqual(validateEvidenceConsoleContract(status, schema), { valid: true, failures: [] });
});

test('object-form gate schema must reject additional gate properties', () => {
  const gateIds = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
  const status = goodStatus({
    gates: Object.fromEntries(gateIds.map(id => [id, 'READY']))
  });
  const schema = goodSchema();
  schema.properties.gates = {
    type: 'object',
    required: gateIds,
    additionalProperties: true,
    properties: Object.fromEntries(gateIds.map(id => [id, constraint('READY')]))
  };
  const result = validateEvidenceConsoleContract(status, schema);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('schema_gate_shape_mismatch'));
});
