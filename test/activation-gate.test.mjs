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

const valid = evaluateActivation({ mode: 'live', evidence: validEvidence(), now });
assert.equal(valid.decision, 'LIVE_APPROVED');
assert.equal(valid.liveExecutionAllowed, true);
assert.equal(valid.passed, REQUIRED_CHECKS.length);

const expiredEvidence = validEvidence();
expiredEvidence.expiresAt = new Date(now.getTime() - 1000).toISOString();
assert.equal(evaluateActivation({ mode: 'live', evidence: expiredEvidence, now }).decision, 'BLOCKED');

const staleEvidence = validEvidence();
staleEvidence.issuedAt = new Date(now.getTime() - 25 * 3600000).toISOString();
staleEvidence.expiresAt = new Date(now.getTime() + 3600000).toISOString();
assert.equal(evaluateActivation({ mode: 'live', evidence: staleEvidence, now }).decision, 'BLOCKED');

const missingSource = validEvidence();
missingSource.checks.postgresIntegrationPassed.reference = '';
assert.equal(evaluateActivation({ mode: 'live', evidence: missingSource, now }).decision, 'BLOCKED');

const failedTenant = validEvidence();
failedTenant.checks.tenantIsolationPassed.passed = false;
assert.equal(evaluateActivation({ mode: 'live', evidence: failedTenant, now }).decision, 'BLOCKED');

const wrongEnv = validEvidence();
wrongEnv.environment = 'staging';
assert.equal(evaluateActivation({ mode: 'live', evidence: wrongEnv, now }).decision, 'BLOCKED');

assert.equal(evaluateActivation({ mode: 'banana', evidence: validEvidence(), now }).decision, 'BLOCKED');
console.log('Activation gate tests: 9 passed, 0 failed');
