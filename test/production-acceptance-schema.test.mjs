import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRODUCTION_ACCEPTANCE_ISSUER,
  PRODUCTION_ACCEPTANCE_SCHEMA,
  PRODUCTION_GATE_IDS,
} from '../lib/production-acceptance-attestation.mjs';

const schema = JSON.parse(readFileSync(
  new URL('../contracts/production-acceptance/v1.schema.json', import.meta.url),
  'utf8',
));

test('schema and verifier agree on the versioned production contract identity', () => {
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.schema.const, PRODUCTION_ACCEPTANCE_SCHEMA);
  assert.equal(schema.properties.issuer.const, PRODUCTION_ACCEPTANCE_ISSUER);
  assert.equal(schema.properties.environment.const, 'production');
  assert.equal(schema.additionalProperties, false);
});

test('schema requires the exact proof-carrying top-level field set', () => {
  const expected = [
    'schema', 'issuer', 'keyId', 'environment', 'buildId',
    'generatedAt', 'expiresAt', 'source', 'execution', 'artifact',
    'suiteResults', 'gates', 'residual', 'digest', 'signature',
  ].sort();
  assert.deepEqual([...schema.required].sort(), expected);
  assert.deepEqual(Object.keys(schema.properties).sort(), expected);
});

test('source and execution fields bind repository revision and successful workflow run', () => {
  const source = schema.properties.source;
  assert.equal(source.additionalProperties, false);
  assert.deepEqual([...source.required].sort(), ['commitSha', 'repository']);
  assert.equal(source.properties.commitSha.pattern, '^[a-fA-F0-9]{40}$');
  const execution = schema.properties.execution;
  assert.equal(execution.additionalProperties, false);
  assert.deepEqual([...execution.required].sort(),
    ['runId', 'runAttempt', 'runUrl', 'headSha', 'conclusion', 'startedAt', 'completedAt'].sort());
  assert.equal(execution.properties.conclusion.const, 'success');
  assert.equal(execution.properties.headSha.pattern, '^[a-fA-F0-9]{40}$');
  assert.equal(execution.properties.completedAt.format, 'date-time');
});

test('immutable artifact identity and required suite results are explicit', () => {
  const artifact = schema.properties.artifact;
  assert.equal(artifact.additionalProperties, false);
  assert.deepEqual([...artifact.required].sort(), ['digest', 'name']);
  assert.equal(artifact.properties.digest.pattern, '^sha256:[a-f0-9]{64}$');
  const suites = schema.properties.suiteResults;
  assert.equal(suites.type, 'array');
  assert.equal(suites.minItems, 1);
  assert.deepEqual([...suites.items.required].sort(),
    ['name', 'conclusion', 'headSha', 'runId', 'runAttempt', 'evidenceUrl', 'evidenceDigest'].sort());
  assert.equal(suites.items.properties.conclusion.const, 'success');
  assert.equal(suites.items.properties.evidenceDigest.pattern, '^[a-f0-9]{64}$');
});

test('G0-G6 are exact and each passing gate carries suite evidence references', () => {
  const gates = schema.properties.gates;
  assert.equal(gates.type, 'array');
  assert.equal(gates.minItems, PRODUCTION_GATE_IDS.length);
  assert.equal(gates.maxItems, PRODUCTION_GATE_IDS.length);
  assert.deepEqual(gates.items.properties.id.enum, [...PRODUCTION_GATE_IDS]);
  assert.equal(gates.items.properties.status.const, 'PASS');
  assert.equal(gates.items.additionalProperties, false);
  assert.deepEqual([...gates.items.required].sort(), ['id', 'status', 'evidence'].sort());
  const evidence = gates.items.properties.evidence;
  assert.equal(evidence.type, 'array');
  assert.ok(evidence.minItems >= 1);
  assert.deepEqual([...evidence.items.required].sort(), ['suiteName', 'evidenceDigest', 'observedAt'].sort());
  assert.equal(evidence.items.additionalProperties, false);
  const requiredIds = gates.allOf.map(rule => rule.contains.properties.id.const).sort();
  assert.deepEqual(requiredIds, [...PRODUCTION_GATE_IDS].sort());
  assert.ok(gates.allOf.every(rule => rule.minContains === 1 && rule.maxContains === 1));
});

test('residual measurement is a separate exact, build-bound object', () => {
  const residual = schema.properties.residual;
  const fields = ['schema', 'sourceId', 'buildId', 'measuredAt', 'S'];
  assert.equal(residual.type, 'object');
  assert.equal(residual.additionalProperties, false);
  assert.deepEqual([...residual.required].sort(), [...fields].sort());
  assert.deepEqual(Object.keys(residual.properties).sort(), [...fields].sort());
  assert.equal(residual.properties.schema.const, 'great-scale.residual-attestation/v1');
  assert.equal(residual.properties.S.type, 'number');
  assert.equal(residual.properties.measuredAt.format, 'date-time');
});

test('digest and Ed25519 signature have fixed wire formats', () => {
  assert.equal(schema.properties.digest.pattern, '^[a-f0-9]{64}$');
  assert.equal(schema.properties.signature.pattern, '^[A-Za-z0-9+/]{86}==$');
  assert.equal(schema.properties.generatedAt.format, 'date-time');
  assert.equal(schema.properties.expiresAt.format, 'date-time');
});
