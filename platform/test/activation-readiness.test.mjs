import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateActivation, ACTIVATION_SCHEMA, REQUIRED_GATES } from '../src/activation/readiness.mjs';
import { evaluateActivation as evaluateRuntimeActivation, REQUIRED_CHECKS as CANONICAL_REQUIRED_CHECKS } from '../../status/activation-gate.mjs';

const nowMs = Date.parse('2026-10-22T12:00:00.000Z');
const releaseSha = 'a'.repeat(40);
function completeEvidence() {
  const observedAt = new Date(nowMs - 60_000).toISOString();
  return {
    schema: ACTIVATION_SCHEMA,
    environment: 'production',
    releaseSha,
    issuedAt: observedAt,
    expiresAt: new Date(nowMs + 60 * 60 * 1000).toISOString(),
    checks: Object.fromEntries(REQUIRED_GATES.map(([id]) => [id, {
      passed: true, reference: 'evidence://' + id, observedAt
    }]))
  };
}
const evaluateComplete = evidence => evaluateActivation({ evidence }, { nowMs, expectedReleaseSha: releaseSha });

test('defaults to safe preview when evidence is absent', () => {
  const result = evaluateActivation({}, { nowMs });
  assert.equal(result.decision, 'SAFE_PREVIEW_ONLY');
  assert.equal(result.previewEnabled, true);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.readinessOnly, true);
  assert.equal(result.passed, 0);
  assert.equal(result.required, 8);
});

test('all eight canonical gates and exact-release evidence yield readiness only', () => {
  const result = evaluateComplete(completeEvidence());
  assert.equal(result.decision, 'READY_FOR_OPERATOR_APPROVAL');
  assert.equal(result.executionEnabled, false);
  assert.equal(result.readyForOperatorApproval, true);
  assert.equal(result.readinessOnly, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.passed, REQUIRED_GATES.length);
});

test('wrong or missing deployed release digest blocks readiness', () => {
  const evidence = completeEvidence();
  assert.equal(evaluateActivation({ evidence }, { nowMs }).executionEnabled, false);
  evidence.releaseSha = 'b'.repeat(40);
  assert.equal(evaluateComplete(evidence).executionEnabled, false);
});

test('missing or unsupported evidence schema blocks readiness', () => {
  const evidence = completeEvidence();
  evidence.schema = 'other/v1';
  assert.equal(evaluateComplete(evidence).executionEnabled, false);
});

test('non-production evidence blocks readiness', () => {
  const evidence = completeEvidence();
  evidence.environment = 'staging';
  assert.equal(evaluateComplete(evidence).executionEnabled, false);
});

test('a single failed criterion blocks readiness', () => {
  const evidence = completeEvidence();
  evidence.checks.executorHealthPassed.passed = false;
  const result = evaluateComplete(evidence);
  assert.equal(result.executionEnabled, false);
  assert.ok(result.blockers.some(b => b.gate === 'executorHealthPassed' && b.status === 'failed'));
});

test('truthy strings are not accepted in place of boolean true', () => {
  const evidence = completeEvidence();
  evidence.checks.postgresIntegrationPassed.passed = 'true';
  assert.equal(evaluateComplete(evidence).executionEnabled, false);
});

test('missing reviewable reference blocks readiness', () => {
  const evidence = completeEvidence();
  evidence.checks.tenantIsolationPassed.reference = '  ';
  assert.ok(evaluateComplete(evidence).blockers.some(b => b.gate === 'tenantIsolationPassed' && b.status === 'missing-reference'));
});

test('stale gate evidence blocks readiness', () => {
  const evidence = completeEvidence();
  evidence.checks.backupRestorePassed.observedAt = new Date(nowMs - 25 * 60 * 60 * 1000).toISOString();
  assert.ok(evaluateComplete(evidence).blockers.some(b => b.gate === 'backupRestorePassed' && b.status === 'stale-or-invalid-time'));
});

test('future-dated gate evidence blocks readiness', () => {
  const evidence = completeEvidence();
  evidence.checks.workerIdentityVerified.observedAt = new Date(nowMs + 60 * 60 * 1000).toISOString();
  assert.equal(evaluateComplete(evidence).executionEnabled, false);
});

test('stale issue time blocks readiness even when checks are recent', () => {
  const evidence = completeEvidence();
  evidence.issuedAt = new Date(nowMs - 25 * 60 * 60 * 1000).toISOString();
  assert.ok(evaluateComplete(evidence).blockers.some(b => b.gate === 'issuedAt' && b.status === 'stale'));
});

test('expired evidence blocks readiness', () => {
  const evidence = completeEvidence();
  evidence.expiresAt = new Date(nowMs - 1000).toISOString();
  assert.ok(evaluateComplete(evidence).blockers.some(b => b.gate === 'expiresAt' && b.status === 'expired'));
});

test('evidence validity longer than 24 hours is rejected', () => {
  const evidence = completeEvidence();
  evidence.expiresAt = new Date(nowMs + 25 * 60 * 60 * 1000).toISOString();
  assert.ok(evaluateComplete(evidence).blockers.some(b => b.gate === 'evidenceLifetime'));
});

test('timezone-naive and non-UTC timestamps are rejected', () => {
  for (const timestamp of ['2026-10-22T11:59:00', '2026-10-22T13:59:00+02:00']) {
    const evidence = completeEvidence();
    evidence.issuedAt = timestamp;
    assert.equal(evaluateComplete(evidence).executionEnabled, false);
  }
});

test('invalid calendar dates and loose timestamp formats are rejected', () => {
  for (const timestamp of ['2026-02-31T11:59:00.000Z', 'October 22, 2026Z', '2026-10-22T11:59:00.000z', '2026-10-22T11:59:00.000-00:00']) {
    const evidence = completeEvidence();
    evidence.issuedAt = timestamp;
    assert.equal(evaluateComplete(evidence).executionEnabled, false);
  }
});

test('UTC +00:00 timestamps are accepted consistently', () => {
  const evidence = completeEvidence();
  evidence.issuedAt = evidence.issuedAt.replace('Z', '+00:00');
  evidence.expiresAt = evidence.expiresAt.replace('Z', '+00:00');
  for (const [id] of REQUIRED_GATES) evidence.checks[id].observedAt = evidence.checks[id].observedAt.replace('Z', '+00:00');
  assert.equal(evaluateComplete(evidence).executionEnabled, true);
});

test('malformed top-level input fails closed', () => {
  for (const input of [null, [], 'yes', 4]) {
    assert.equal(evaluateActivation(input, { nowMs, expectedReleaseSha: releaseSha }).executionEnabled, false);
  }
});

test('invalid evaluator options are rejected', () => {
  assert.throws(() => evaluateActivation({}, { nowMs: NaN }), TypeError);
  assert.throws(() => evaluateActivation({}, { nowMs, maxAgeMs: 25 * 60 * 60 * 1000 }), TypeError);
});

test('platform adapter uses canonical gate identifiers and matches runtime decision', () => {
  assert.deepEqual(REQUIRED_GATES, CANONICAL_REQUIRED_CHECKS);
  const evidence = completeEvidence();
  const runtime = evaluateRuntimeActivation({
    mode: 'live',
    evidence,
    now: new Date(nowMs),
    expectedReleaseSha: releaseSha
  });
  const platform = evaluateActivation({ evidence }, { nowMs, expectedReleaseSha: releaseSha });
  assert.equal(platform.readyForOperatorApproval, runtime.liveExecutionAllowed);
  assert.equal(platform.executionEnabled, false);
  assert.equal(platform.passed, runtime.passed);
  assert.equal(platform.required, runtime.required);
  assert.equal(platform.blockers.length, 0);
});

test('a stricter evidence age window is enforced and reported as a blocker', () => {
  const evidence = completeEvidence();
  const result = evaluateActivation({ evidence }, {
    nowMs,
    expectedReleaseSha: releaseSha,
    maxAgeMs: 30 * 60 * 1000
  });
  assert.equal(result.executionEnabled, false);
  assert.ok(result.blockers.some(b => b.gate === 'evidenceLifetime' && b.status === 'invalid'));
});
