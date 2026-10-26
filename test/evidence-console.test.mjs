import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeEvidenceConsole,
  validateEvidenceConsoleContract
} from '../lib/evidence-console.mjs';

const expected = {
  version: '5.3.1',
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
  return {
    ...expected,
    overall: 'READY',
    gates: Array.from({ length: 7 }, (_, i) => ({ id: `G${i}`, status: 'READY' })),
    ...overrides
  };
}

function constraint(value) {
  return { const: value };
}

function goodSchema(overrides = {}) {
  const properties = {
    version: constraint(expected.version),
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
    required: [...Object.keys(expected), 'overall', 'gates'],
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

test('gate schema must enumerate all seven required gate IDs', () => {
  const schema = goodSchema();
  schema.properties.gates.items.properties.id.enum = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'];
  const result = validateEvidenceConsoleContract(goodStatus(), schema);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('schema_gate_shape_mismatch'));
});
