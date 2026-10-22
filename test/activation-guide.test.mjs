import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGuide, GUIDE_CHECKS } from '../status/activation-guide.mjs';

function fullDecision(overrides = {}) {
  return {
    decision: 'LIVE_APPROVED',
    liveExecutionAllowed: true,
    passed: 8,
    required: 8,
    checks: GUIDE_CHECKS.map(([id, label]) => ({ id, label, passed: true, referencePresent: true, fresh: true })),
    ...overrides
  };
}

test('defaults to safe preview and blocks live activation when evidence is missing', () => {
  const report = buildGuide({ requestedMode: 'preview', liveDecision: { decision: 'BLOCKED', liveExecutionAllowed: false, passed: 0, required: 8, checks: [] } });
  assert.equal(report.recommendedMode, 'PREVIEW (safe default)');
  assert.equal(report.configuredMode, 'preview');
  assert.equal(report.evidenceDecision, 'NO-GO — LIVE ACTIVATION IS NOT APPROVED');
  assert.equal(report.passed, 0);
  assert.equal(report.required, 8);
  assert.match(report.nextAction, /Build and automated checks passed/);
});

test('reports the first unmet action in success-criteria order', () => {
  const decision = fullDecision({ liveExecutionAllowed: false, checks: GUIDE_CHECKS.slice(0, 2).map(([id, label]) => ({ id, label, passed: true, referencePresent: true, fresh: true })) });
  const report = buildGuide({ liveDecision: decision });
  assert.equal(report.passed, 2);
  assert.match(report.nextAction, /Tenant separation was verified/);
});

test('even complete evidence does not turn on execution', () => {
  const report = buildGuide({ liveDecision: fullDecision() });
  assert.equal(report.evidenceDecision, 'EVIDENCE COMPLETE — RUNTIME SETTINGS AND HUMAN REVIEW STILL REQUIRED');
  assert.match(report.nextAction, /never enables execution/i);
  assert.match(report.safetyBoundary, /does not enable workers/i);
  assert.equal(report.configuredMode, 'preview');
});

test('never returns evidence references or secret-like fields', () => {
  const decision = fullDecision({ checks: GUIDE_CHECKS.map(([id, label]) => ({ id, label, passed: true, referencePresent: true, fresh: true, reference: 'https://secret.example/token=DO_NOT_SHOW' })) });
  const report = JSON.stringify(buildGuide({ liveDecision: decision }));
  assert.equal(report.includes('secret.example'), false);
  assert.equal(report.includes('DO_NOT_SHOW'), false);
});

test('keeps eight named checks in a deterministic order', () => {
  assert.equal(GUIDE_CHECKS.length, 8);
  assert.deepEqual(GUIDE_CHECKS.map(([id]) => id), [
    'ciPassed', 'postgresIntegrationPassed', 'tenantIsolationPassed', 'stagingSecurityReviewPassed',
    'backupRestorePassed', 'workerIdentityVerified', 'executorHealthPassed', 'operatorApproved'
  ]);
});
