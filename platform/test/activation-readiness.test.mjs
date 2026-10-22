import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateActivation, REQUIRED_GATES } from '../src/activation/readiness.mjs';

const nowMs = Date.parse('2026-10-22T12:00:00.000Z');
function completeEvidence() {
  return Object.fromEntries(REQUIRED_GATES.map(gate => [gate, {
    passed: true, verifiedAt: new Date(nowMs - 60_000).toISOString()
  }]));
}

test('defaults to safe preview when evidence is absent', () => {
  const result = evaluateActivation({}, { nowMs });
  assert.equal(result.decision, 'SAFE_PREVIEW_ONLY');
  assert.equal(result.previewEnabled, true);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.blockers.length, REQUIRED_GATES.length);
});

test('all eight gates with fresh evidence allow a readiness decision', () => {
  const result = evaluateActivation({ evidence: completeEvidence() }, { nowMs });
  assert.equal(result.decision, 'ENABLE_EXECUTION');
  assert.equal(result.executionEnabled, true);
  assert.deepEqual(result.blockers, []);
});

test('one failed gate blocks execution', () => {
  const evidence = completeEvidence();
  evidence.executorConnected.passed = false;
  const result = evaluateActivation({ evidence }, { nowMs });
  assert.equal(result.executionEnabled, false);
  assert.ok(result.blockers.some(b => b.gate === 'executorConnected' && b.status === 'failed'));
});

test('truthy strings are not accepted as evidence', () => {
  const evidence = completeEvidence();
  evidence.postgresConnected.passed = 'true';
  const result = evaluateActivation({ evidence }, { nowMs });
  assert.equal(result.executionEnabled, false);
  assert.ok(result.blockers.some(b => b.gate === 'postgresConnected' && b.status === 'invalid-evidence'));
});

test('stale evidence blocks execution', () => {
  const evidence = completeEvidence();
  evidence.schemaCurrent.verifiedAt = new Date(nowMs - 25 * 60 * 60 * 1000).toISOString();
  const result = evaluateActivation({ evidence }, { nowMs });
  assert.ok(result.blockers.some(b => b.gate === 'schemaCurrent' && b.status === 'stale-or-invalid-evidence'));
});

test('future-dated evidence blocks execution', () => {
  const evidence = completeEvidence();
  evidence.rollbackTestPassed.verifiedAt = new Date(nowMs + 60_000).toISOString();
  const result = evaluateActivation({ evidence }, { nowMs });
  assert.ok(result.blockers.some(b => b.gate === 'rollbackTestPassed' && b.status === 'stale-or-invalid-evidence'));
});

test('malformed top-level input fails closed', () => {
  for (const input of [null, [], 'yes', 4]) {
    assert.equal(evaluateActivation(input, { nowMs }).executionEnabled, false);
  }
});

test('explicit operator denial blocks execution', () => {
  const evidence = completeEvidence();
  evidence.operatorApproved = { passed: false, verifiedAt: new Date(nowMs).toISOString() };
  const result = evaluateActivation({ evidence }, { nowMs });
  assert.ok(result.blockers.some(b => b.gate === 'operatorApproved' && b.status === 'failed'));
});
