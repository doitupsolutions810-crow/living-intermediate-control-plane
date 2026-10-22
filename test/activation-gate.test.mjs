import assert from 'node:assert/strict';
import { evaluateActivation, ACTIVATION_SCHEMA, REQUIRED_CHECKS } from '../status/activation-gate.mjs';

const now = new Date('2026-10-22T12:00:00.000Z');
function validEvidence() {
  const observedAt = new Date(now.getTime() - 60000).toISOString();
  const checks = Object.fromEntries(REQUIRED_CHECKS.map(function (entry) {
    const id = entry[0];
    return [id, { passed: true, reference: 'test-evidence:' + id, observedAt }];
  }));
  return {
    schema: ACTIVATION_SCHEMA,
    environment: 'production',
    releaseSha: 'a'.repeat(40),
    issuedAt: observedAt,
    expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    checks
  };
}

const preview = evaluateActivation({ mode: 'preview', now });
assert.equal(preview.decision, 'SAFE_PREVIEW');
assert.equal(preview.liveExecutionAllowed, false);
assert.ok(preview.blockedCapabilities.includes('live worker execution'));

const missing = evaluateActivation({ mode: 'live', now });
assert.equal(missing.decision, 'BLOCKED');
assert.ok(missing.blockers.some(function (value) { return value.includes('missing'); }));

assert.equal(evaluateActivation({ mode: 'live', evidence: validEvidence(), now }).decision, 'BLOCKED');

const valid = evaluateActivation({ mode: 'live', evidence: validEvidence(), now, expectedReleaseSha: 'a'.repeat(40) });
assert.equal(valid.decision, 'LIVE_APPROVED');
assert.equal(valid.liveExecutionAllowed, true);
assert.equal(valid.passed, REQUIRED_CHECKS.length);

const naiveTimestamp = validEvidence();
naiveTimestamp.issuedAt = '2026-10-22T11:59:00';
assert.equal(evaluateActivation({ mode: 'live', evidence: naiveTimestamp, now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'BLOCKED');

const offsetTimestamp = validEvidence();
offsetTimestamp.issuedAt = '2026-10-22T11:59:00+02:00';
assert.equal(evaluateActivation({ mode: 'live', evidence: offsetTimestamp, now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'BLOCKED');

const expiredEvidence = validEvidence();
expiredEvidence.expiresAt = new Date(now.getTime() - 1000).toISOString();
assert.equal(evaluateActivation({ mode: 'live', evidence: expiredEvidence, now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'BLOCKED');

const staleEvidence = validEvidence();
staleEvidence.issuedAt = new Date(now.getTime() - 25 * 3600000).toISOString();
staleEvidence.expiresAt = new Date(now.getTime() + 3600000).toISOString();
assert.equal(evaluateActivation({ mode: 'live', evidence: staleEvidence, now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'BLOCKED');

const missingSource = validEvidence();
missingSource.checks.postgresIntegrationPassed.reference = '';
assert.equal(evaluateActivation({ mode: 'live', evidence: missingSource, now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'BLOCKED');

const failedTenant = validEvidence();
failedTenant.checks.tenantIsolationPassed.passed = false;
assert.equal(evaluateActivation({ mode: 'live', evidence: failedTenant, now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'BLOCKED');

const wrongEnv = validEvidence();
wrongEnv.environment = 'staging';
assert.equal(evaluateActivation({ mode: 'live', evidence: wrongEnv, now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'BLOCKED');

assert.equal(evaluateActivation({ mode: 'banana', evidence: validEvidence(), now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'BLOCKED');

const mismatchedRelease = validEvidence();
mismatchedRelease.releaseSha = 'b'.repeat(40);
assert.equal(evaluateActivation({ mode: 'live', evidence: mismatchedRelease, now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'BLOCKED');

const utcOffsetTimestamp = validEvidence();
utcOffsetTimestamp.issuedAt = new Date(now.getTime() - 60000).toISOString().replace('Z', '+00:00');
utcOffsetTimestamp.expiresAt = new Date(now.getTime() + 3600000).toISOString().replace('Z', '+00:00');
utcOffsetTimestamp.checks.ciPassed.observedAt = new Date(now.getTime() - 60000).toISOString().replace('Z', '+00:00');
assert.equal(evaluateActivation({ mode: 'live', evidence: utcOffsetTimestamp, now, expectedReleaseSha: 'a'.repeat(40) }).decision, 'LIVE_APPROVED');

console.log('Activation gate policy checks: PASS');
