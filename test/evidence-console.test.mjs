import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { buildEvidenceStatusDocument, sealEvidenceStatusDocument, canonicalJson, verifyEvidenceStatusDocument } from '../lib/evidence-status-document.mjs';
import {
  probeEvidenceConsole,
  validateEvidenceConsoleContract,
  signedEvidenceDigest,
  verifySignedEvidence
} from '../lib/evidence-console.mjs';

const keyPair = generateKeyPairSync('ed25519');
const trust = {
  trustedSourceIdentity: 'test-evidence-producer',
  trustedKeyId: 'test-key-2026-01',
  publicKeyPem: keyPair.publicKey.export({ type: 'spki', format: 'pem' })
};

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
    sourceIdentity: trust.trustedSourceIdentity,
    sourceKeyId: trust.trustedKeyId,
    overall: 'READY',
    gates: Array.from({ length: 7 }, (_, i) => ({ id: `G${i}`, status: 'READY' })),
    ...overrides
  };
  status.sourceEvidenceDigest = signedEvidenceDigest(status);
  status.sourceSignature = sign(null, Buffer.from(status.sourceEvidenceDigest, 'hex'), keyPair.privateKey).toString('base64');
  return status;
}

function constraint(value) {
  return { const: value };
}

function goodSchema(overrides = {}) {
  const properties = {
    version: constraint(expected.version),
    sourceGeneratedAt: { type: 'string', format: 'date-time' },
    sourceExpiresAt: { type: 'string', format: 'date-time' },
    sourceIdentity: { type: 'string', minLength: 1 },
    sourceKeyId: { type: 'string', minLength: 1 },
    sourceEvidenceDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    sourceSignature: { type: 'string', minLength: 1 },
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
    required: [...Object.keys(expected), 'sourceGeneratedAt', 'sourceExpiresAt', 'sourceIdentity', 'sourceKeyId', 'sourceEvidenceDigest', 'sourceSignature', 'overall', 'gates'],
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
    ...trust,
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
test('signed evidence verifies with the pinned Ed25519 key', () => {
  const status = goodStatus();
  assert.deepEqual(verifySignedEvidence(status, trust), { valid: true, failures: [] });
});

test('tampered payload, signature, source identity, and key ID are rejected', () => {
  const original = goodStatus();
  const tampered = { ...original, overall: 'HOLD' };
  assert.ok(verifySignedEvidence(tampered, trust).failures.includes('signature_digest_mismatch'));

  const badSignature = { ...original, sourceSignature: Buffer.alloc(64).toString('base64') };
  assert.ok(verifySignedEvidence(badSignature, trust).failures.includes('signature_verification_failed'));

  const wrongSource = { ...original, sourceIdentity: 'attacker' };
  assert.ok(verifySignedEvidence(wrongSource, trust).failures.includes('signature_source_identity_mismatch'));

  const wrongKey = { ...original, sourceKeyId: 'untrusted-key' };
  assert.ok(verifySignedEvidence(wrongKey, trust).failures.includes('signature_key_id_mismatch'));
});

test('missing trust configuration never authorizes public evidence', () => {
  const result = verifySignedEvidence(goodStatus(), {
    trustedSourceIdentity: '',
    trustedKeyId: '',
    publicKeyPem: ''
  });
  assert.deepEqual(result, { valid: false, failures: ['signature_trust_configuration_missing'] });
});

test('public probe fails closed when a structurally valid response lacks trusted signing configuration', async () => {
  const status = goodStatus();
  const result = await probeEvidenceConsole({
    url: 'https://evidence.example.invalid',
    acceptLocal: true,
    fetchImpl: async url => String(url).endsWith('/api/status')
      ? new Response(JSON.stringify(status), { status: 200 })
      : new Response(JSON.stringify(goodSchema()), { status: 200 })
  });
  assert.equal(result.status, 'invalid');
  assert.equal(result.authority, 'local');
  assert.equal(result.trustContractVerified, false);
  assert.ok(result.trustFailures.includes('signature_trust_configuration_missing'));
});


test('failed evidence without local opt-in is explicitly untrusted, never public', async () => {
  const result = await probeEvidenceConsole({
    url: 'https://evidence.example.invalid',
    acceptLocal: false,
    fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
  });
  assert.equal(result.status, 'invalid');
  assert.equal(result.authority, 'none');
  assert.equal(result.trustContractVerified, false);
});

test('missing schema required-list is rejected without throwing', () => {
  const schema = goodSchema();
  delete schema.required;
  const result = validateEvidenceConsoleContract(goodStatus(), schema);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('schema_required_fields_missing'));
  assert.ok(result.failures.includes('schema_required_sourceIdentity_missing'));
});

test('E0-E6 procurement evidence producer cannot grant G0-G6 production authority', async () => {
  const procurementDocument = sealEvidenceStatusDocument(
    buildEvidenceStatusDocument({ S: 0, authority: 'public' }),
    {
      privateKeyPem: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
      keyId: trust.trustedKeyId
    }
  );
  const schema = goodSchema();
  const result = await probeEvidenceConsole({
    url: 'https://evidence.example.invalid',
    ...trust,
    fetchImpl: async url => {
      if (String(url).endsWith('/api/status')) {
        return new Response(JSON.stringify(procurementDocument), {
          status: 200, headers: { 'content-type': 'application/json' }
        });
      }
      if (String(url).endsWith('/api/v1/evidence/schema')) {
        return new Response(JSON.stringify(schema), {
          status: 200, headers: { 'content-type': 'application/json' }
        });
      }
      return new Response('missing', { status: 404 });
    }
  });
  assert.equal(procurementDocument.namespaces.evidence, 'E0-E6');
  assert.equal(procurementDocument.namespaces.production, 'G0-G6');
  assert.equal(result.status, 'invalid');
  assert.notEqual(result.authority, 'public');
  assert.equal(result.trustContractVerified, false);
  assert.ok(result.trustFailures.some(failure => failure.startsWith('status_')));
});


test('E0-E6 procurement producer cannot satisfy the G0-G6 public production consumer contract', () => {
  const procurementDocument = sealEvidenceStatusDocument(
    buildEvidenceStatusDocument({ S: 0, authority: 'local' }),
    {
      privateKeyPem: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
      keyId: trust.trustedKeyId
    }
  );
  const result = validateEvidenceConsoleContract(procurementDocument, goodSchema());
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('status_runtime_mismatch'));
  assert.ok(result.failures.includes('status_source_freshness_timestamps_invalid'));
  assert.ok(result.failures.includes('status_gates_not_all_ready_or_incomplete'));
  assert.equal(procurementDocument.namespaces.evidence, 'E0-E6');
  assert.equal(procurementDocument.namespaces.production, 'G0-G6');
  assert.equal(procurementDocument.productionClaimed, undefined);
});


test('producer-style signature over canonical JSON bytes is not accepted as a consumer signature over raw digest bytes', () => {
  const unsignedStatus = {
    ...expected,
    sourceGeneratedAt: new Date().toISOString(),
    sourceExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    sourceIdentity: trust.trustedSourceIdentity,
    sourceKeyId: trust.trustedKeyId,
    overall: 'READY',
    gates: Array.from({ length: 7 }, (_, i) => ({ id: `G${i}`, status: 'READY' }))
  };
  const digest = signedEvidenceDigest(unsignedStatus);
  const producerStyleSignature = sign(
    null,
    Buffer.from(canonicalJson(unsignedStatus), 'utf8'),
    keyPair.privateKey
  ).toString('base64');
  const status = {
    ...unsignedStatus,
    sourceEvidenceDigest: digest,
    sourceSignature: producerStyleSignature
  };
  const result = verifySignedEvidence(status, trust);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('signature_verification_failed'));
});


test('missing procurement check results default to HOLD even when the residual cone predicate is true', () => {
  const status = buildEvidenceStatusDocument({ S: 0 });
  assert.equal(status.residual.coneOk, true);
  assert.deepEqual(status.contractChecks.map(check => check.status), Array(7).fill('HOLD'));
  assert.equal(status.authority, 'local');
});

test('evidence status builder rejects missing, duplicate, or foreign procurement gate IDs', () => {
  const checks = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'].map(id => ({ id, status: 'READY' }));
  assert.throws(
    () => buildEvidenceStatusDocument({ contractChecks: checks.slice(0, 6) }),
    /each E0–E6 gate exactly once/
  );
  assert.throws(
    () => buildEvidenceStatusDocument({ contractChecks: [...checks.slice(0, 6), { id: 'E5', status: 'READY' }] }),
    /each E0–E6 gate exactly once/
  );
  assert.throws(
    () => buildEvidenceStatusDocument({ contractChecks: [...checks.slice(0, 6), { id: 'G6', status: 'READY' }] }),
    /each E0–E6 gate exactly once/
  );
});

test('residual status producer rejects non-finite and out-of-domain coordinates', () => {
  for (const S of [Infinity, -Infinity, NaN, -0.01, 0.250001]) {
    assert.throws(() => buildEvidenceStatusDocument({ S }), /Residual coordinate S must be finite and within/);
  }
  for (const tau of [Infinity, -Infinity, NaN, -0.01, 1.00001]) {
    assert.throws(() => buildEvidenceStatusDocument({ tau }), /Topology saturation tau must be finite and within/);
  }
  assert.throws(() => buildEvidenceStatusDocument({ ttlMs: Infinity }), /Evidence TTL must be positive/);
});

test('metadata cannot override producer authority, gate namespace, or production claims', () => {
  for (const extra of [
    { authority: 'public' },
    { contractChecks: Array.from({ length: 7 }, (_, i) => ({ id: `E${i}`, status: 'READY' })) },
    { namespaces: { evidence: 'E0-E6', production: 'G0-G6', independent: true } },
    { productionClaimed: true },
    { gates: Array.from({ length: 7 }, (_, i) => ({ id: `G${i}`, status: 'READY' })) }
  ]) {
    assert.throws(() => buildEvidenceStatusDocument({ extra }), /extra cannot override protected evidence field/);
  }
});

test('producer verifier rejects signed documents with invalid check status values', () => {
  const status = buildEvidenceStatusDocument({
    S: 0,
    contractChecks: ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'].map(id => ({ id, status: 'READY' }))
  });
  status.contractChecks[0].status = 'MAYBE';
  const sealed = sealEvidenceStatusDocument(status, {
    privateKeyPem: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    keyId: trust.trustedKeyId
  });
  const result = verifyEvidenceStatusDocument(sealed, {
    publicKeyPem: trust.publicKeyPem,
    keyId: trust.trustedKeyId
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(failure => failure.code === 'E_GATES' && failure.detail.includes('invalid status')));
});


test('producer verifier rejects signed evidence with an excessive or inverted freshness window', () => {
  const tooLong = buildEvidenceStatusDocument({ S: 0 });
  tooLong.expiresAt = new Date(Date.parse(tooLong.generatedAt) + 24 * 60 * 60 * 1000).toISOString();
  const sealedTooLong = sealEvidenceStatusDocument(tooLong, {
    privateKeyPem: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    keyId: trust.trustedKeyId
  });
  const longResult = verifyEvidenceStatusDocument(sealedTooLong, {
    publicKeyPem: trust.publicKeyPem,
    keyId: trust.trustedKeyId
  });
  assert.equal(longResult.valid, false);
  assert.ok(longResult.failures.some(failure =>
    failure.code === 'FRESHNESS' && failure.detail.includes('five-minute maximum')
  ));

  const inverted = buildEvidenceStatusDocument({ S: 0 });
  inverted.expiresAt = new Date(Date.parse(inverted.generatedAt) - 1).toISOString();
  const sealedInverted = sealEvidenceStatusDocument(inverted, {
    privateKeyPem: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    keyId: trust.trustedKeyId
  });
  const invertedResult = verifyEvidenceStatusDocument(sealedInverted, {
    publicKeyPem: trust.publicKeyPem,
    keyId: trust.trustedKeyId
  });
  assert.equal(invertedResult.valid, false);
  assert.ok(invertedResult.failures.some(failure =>
    failure.code === 'FRESHNESS' && failure.detail.includes('after generatedAt')
  ));
});

test('producer verifier rejects signed residuals outside the topology-derived domain', () => {
  const status = buildEvidenceStatusDocument({ S: 0 });
  status.residual.S = 0.5;
  const sealed = sealEvidenceStatusDocument(status, {
    privateKeyPem: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    keyId: trust.trustedKeyId
  });
  const result = verifyEvidenceStatusDocument(sealed, {
    publicKeyPem: trust.publicKeyPem,
    keyId: trust.trustedKeyId
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(failure => failure.code === 'RESIDUAL_DOMAIN'));
});

test('producer verifier rejects signed residuals whose derived coordinates disagree', () => {
  const status = buildEvidenceStatusDocument({ S: 0.1 });
  status.residual.logCoord = 99;
  const sealed = sealEvidenceStatusDocument(status, {
    privateKeyPem: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    keyId: trust.trustedKeyId
  });
  const result = verifyEvidenceStatusDocument(sealed, {
    publicKeyPem: trust.publicKeyPem,
    keyId: trust.trustedKeyId
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some(failure => failure.code === 'RESIDUAL_CONSISTENCY'));
});
