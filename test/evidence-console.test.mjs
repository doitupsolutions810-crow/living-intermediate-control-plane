import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  probeEvidenceConsole,
  validateEvidenceConsoleContract
} from '../lib/evidence-console.mjs';

const signingPair = generateKeyPairSync('ed25519');
const sourcePrivateKeyPem = signingPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
const sourcePublicKeyPem = signingPair.publicKey.export({ type: 'spki', format: 'pem' });
process.env.EVIDENCE_SOURCE_KEY_ID = 'test-source-key-1';
process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = sourcePublicKeyPem;

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(item => item === undefined ? 'null' : canonicalJson(item)).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function signStatus(status) {
  const unsigned = { ...status };
  delete unsigned.sourceEvidenceDigest;
  delete unsigned.sourceSignature;
  status.sourceEvidenceDigest = createHash('sha256').update(canonicalJson(unsigned)).digest('hex');
  const message = [status.sourceIdentity, status.sourceKeyId, status.sourceGeneratedAt, status.sourceExpiresAt, status.sourceEvidenceDigest].join('\\n');
  status.sourceSignature = sign(null, Buffer.from(message), sourcePrivateKeyPem).toString('base64');
  return status;
}

const expected = {
  version: '5.4.0',
  runtime: 'static',
  privacy: 'local-only',
  serverSideEvidenceStorage: false,
  syntheticEvidenceRejected: true,
  productionEvidenceClassRequired: true,
  requiredEvidenceClass: 'production-acceptance',
  requiredEnvironment: 'production',
  mandatoryGates: 7
};

function goodStatus(overrides = {}) {
  const status = {
    ...expected,
    sourceGeneratedAt: new Date().toISOString(),
    sourceExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    sourceIdentity: 'control12-evidence-console',
    sourceKeyId: 'test-source-key-1',
    overall: 'READY',
    gates: Array.from({ length: 7 }, (_, i) => ({ id: `G${i}`, status: 'READY' })),
    ...overrides
  };
  return signStatus(status);
}

function constraint(value) {
  return { const: value };
}

function goodSchema(overrides = {}) {
  const properties = {
    version: constraint(expected.version),
    sourceGeneratedAt: { type: 'string', format: 'date-time' },
    sourceExpiresAt: { type: 'string', format: 'date-time' },
    sourceIdentity: constraint('control12-evidence-console'),
    sourceKeyId: constraint('test-source-key-1'),
    sourceEvidenceDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    sourceSignature: { type: 'string', pattern: '^[A-Za-z0-9+/]{86}==$' },
    runtime: constraint(expected.runtime),
    privacy: constraint(expected.privacy),
    serverSideEvidenceStorage: constraint(false),
    syntheticEvidenceRejected: constraint(true),
    productionEvidenceClassRequired: constraint(true),
    requiredEvidenceClass: constraint(expected.requiredEvidenceClass),
    requiredEnvironment: constraint(expected.requiredEnvironment),
    mandatoryGates: constraint(7),
    overall: { enum: ['READY', 'HOLD'] },
    gates: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      uniqueItems: true,
      allOf: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'].map(id => ({
        contains: { type: 'object', required: ['id'], properties: { id: constraint(id) } },
        minContains: 1,
        maxContains: 1
      })),
      items: {
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: { enum: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] },
          status: constraint('READY')
        }
      }
    }
  };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: [...Object.keys(expected), 'sourceIdentity', 'sourceKeyId', 'sourceEvidenceDigest', 'sourceSignature', 'sourceGeneratedAt', 'sourceExpiresAt', 'overall', 'gates'],
    properties: { ...properties, ...overrides }
  };
}

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
      { id: 'G0', status: 'READY' },
      { id: 'G1', status: 'READY' },
      { id: 'G2', status: 'READY' },
      { id: 'G3', status: 'READY' },
      { id: 'G4', status: 'READY' },
      { id: 'G5', status: 'READY' },
      { id: 'G5', status: 'READY' }
    ]
  });
  const result = validateEvidenceConsoleContract(status, goodSchema());
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_gates_not_all_ready_or_incomplete'));
});

test('gate schema must require exactly one occurrence of every G0-G6 ID', () => {
  const schema = goodSchema();
  schema.properties.gates.allOf = schema.properties.gates.allOf.filter(rule =>
    rule.contains.properties.id.const !== 'G6'
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

test('object-form gate map validates only the required G0-G6 properties', () => {
  const gateIds = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
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
  const gateIds = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
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
 },
    sourceSignature: { type: 'string', pattern: '^[A-Za-z0-9+/]{86}==
    runtime: constraint(expected.runtime),
    privacy: constraint(expected.privacy),
    serverSideEvidenceStorage: constraint(false),
    syntheticEvidenceRejected: constraint(true),
    productionEvidenceClassRequired: constraint(true),
    requiredEvidenceClass: constraint(expected.requiredEvidenceClass),
    requiredEnvironment: constraint(expected.requiredEnvironment),
    mandatoryGates: constraint(7),
    overall: { enum: ['READY', 'HOLD'] },
    gates: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      uniqueItems: true,
      allOf: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'].map(id => ({
        contains: { type: 'object', required: ['id'], properties: { id: constraint(id) } },
        minContains: 1,
        maxContains: 1
      })),
      items: {
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: { enum: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] },
          status: constraint('READY')
        }
      }
    }
  };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: [...Object.keys(expected), 'sourceGeneratedAt', 'sourceExpiresAt', 'overall', 'gates'],
    properties: { ...properties, ...overrides }
  };
}

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
      { id: 'G0', status: 'READY' },
      { id: 'G1', status: 'READY' },
      { id: 'G2', status: 'READY' },
      { id: 'G3', status: 'READY' },
      { id: 'G4', status: 'READY' },
      { id: 'G5', status: 'READY' },
      { id: 'G5', status: 'READY' }
    ]
  });
  const result = validateEvidenceConsoleContract(status, goodSchema());
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_gates_not_all_ready_or_incomplete'));
});

test('gate schema must require exactly one occurrence of every G0-G6 ID', () => {
  const schema = goodSchema();
  schema.properties.gates.allOf = schema.properties.gates.allOf.filter(rule =>
    rule.contains.properties.id.const !== 'G6'
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

test('object-form gate map validates only the required G0-G6 properties', () => {
  const gateIds = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
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
  const gateIds = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
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
 },
    runtime: constraint(expected.runtime),
    privacy: constraint(expected.privacy),
    serverSideEvidenceStorage: constraint(false),
    syntheticEvidenceRejected: constraint(true),
    productionEvidenceClassRequired: constraint(true),
    requiredEvidenceClass: constraint(expected.requiredEvidenceClass),
    requiredEnvironment: constraint(expected.requiredEnvironment),
    mandatoryGates: constraint(7),
    overall: { enum: ['READY', 'HOLD'] },
    gates: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      uniqueItems: true,
      allOf: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'].map(id => ({
        contains: { type: 'object', required: ['id'], properties: { id: constraint(id) } },
        minContains: 1,
        maxContains: 1
      })),
      items: {
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: { enum: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] },
          status: constraint('READY')
        }
      }
    }
  };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: [...Object.keys(expected), 'sourceGeneratedAt', 'sourceExpiresAt', 'overall', 'gates'],
    properties: { ...properties, ...overrides }
  };
}

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
      { id: 'G0', status: 'READY' },
      { id: 'G1', status: 'READY' },
      { id: 'G2', status: 'READY' },
      { id: 'G3', status: 'READY' },
      { id: 'G4', status: 'READY' },
      { id: 'G5', status: 'READY' },
      { id: 'G5', status: 'READY' }
    ]
  });
  const result = validateEvidenceConsoleContract(status, goodSchema());
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_gates_not_all_ready_or_incomplete'));
});

test('gate schema must require exactly one occurrence of every G0-G6 ID', () => {
  const schema = goodSchema();
  schema.properties.gates.allOf = schema.properties.gates.allOf.filter(rule =>
    rule.contains.properties.id.const !== 'G6'
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

test('object-form gate map validates only the required G0-G6 properties', () => {
  const gateIds = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
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
  const gateIds = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
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


test('public evidence requires a valid source signature and rejects tampering', async () => {
  const status = goodStatus();
  status.sourceSignature = (status.sourceSignature[0] === 'A' ? 'B' : 'A') + status.sourceSignature.slice(1);
  const schema = goodSchema();
  const result = await probeEvidenceConsole({
    url: 'https://evidence.example.invalid',
    fetchImpl: async url => String(url).endsWith('/api/status')
      ? new Response(JSON.stringify(status), { status: 200 })
      : new Response(JSON.stringify(schema), { status: 200 })
  });
  assert.equal(result.status, 'invalid');
  assert.equal(result.authority, 'local');
  assert.equal(result.trustContractVerified, false);
  assert.ok(result.trustFailures.includes('source_signature_invalid'));
});

test('public evidence fails closed when the independent trust anchor is absent', async () => {
  const oldKey = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
  try {
    delete process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
    const status = goodStatus();
    const schema = goodSchema();
    const result = await probeEvidenceConsole({
      url: 'https://evidence.example.invalid',
      fetchImpl: async url => String(url).endsWith('/api/status')
        ? new Response(JSON.stringify(status), { status: 200 })
        : new Response(JSON.stringify(schema), { status: 200 })
    });
    assert.equal(result.status, 'invalid');
    assert.equal(result.trustContractVerified, false);
    assert.ok(result.trustFailures.includes('source_trust_anchor_unconfigured'));
  } finally {
    process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = oldKey;
  }
});
