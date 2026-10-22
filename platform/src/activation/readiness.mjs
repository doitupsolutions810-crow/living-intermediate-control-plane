/**
 * Fail-closed activation readiness policy for AVRONE CONTROL12.
 * Evaluates evidence only. It never connects services, deploys, or starts workers.
 * Gate IDs align with status/activation-gate.mjs in the control-plane activation branch.
 */
export const ACTIVATION_SCHEMA = 'avrone.activation-evidence/v1';
export const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;
export const REQUIRED_GATES = Object.freeze([
  ['ciPassed', 'Build and automated checks passed'],
  ['postgresIntegrationPassed', 'Real PostgreSQL integration passed'],
  ['tenantIsolationPassed', 'Tenant separation was verified'],
  ['stagingSecurityReviewPassed', 'Staging security review was approved'],
  ['backupRestorePassed', 'Backup and restore were tested'],
  ['workerIdentityVerified', 'Worker identities and rotation were verified'],
  ['executorHealthPassed', 'The approved executor answered its health check'],
  ['operatorApproved', 'An authorized operator approved live execution']
]);

function strictUtcTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(text);
  if (!match) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  const date = new Date(parsed);
  const expected = match.slice(1, 7).map(Number);
  if (expected[0] < 1 ||
      date.getUTCFullYear() !== expected[0] ||
      date.getUTCMonth() + 1 !== expected[1] ||
      date.getUTCDate() !== expected[2] ||
      date.getUTCHours() !== expected[3] ||
      date.getUTCMinutes() !== expected[4] ||
      date.getUTCSeconds() !== expected[5]) return null;
  return parsed;
}

function shaLike(value) {
  return typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value);
}

/**
 * Input evidence includes schema, environment, releaseSha, issuedAt, expiresAt,
 * and checks keyed by REQUIRED_GATES, each with passed, reference, observedAt.
 * Options include nowMs, maxAgeMs, and expectedReleaseSha.
 * A readiness result never changes runtime flags or starts execution.
 */
export function evaluateActivation(input, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? MAX_EVIDENCE_AGE_MS;
  if (!Number.isFinite(nowMs) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || maxAgeMs > MAX_EVIDENCE_AGE_MS) {
    throw new TypeError('nowMs and maxAgeMs must be finite, with maxAgeMs between 1 ms and 24 hours');
  }

  const evidence = input && typeof input === 'object' && !Array.isArray(input)
    ? input.evidence : null;
  const blockers = [];
  const gates = {};
  const addBlocker = (gate, status, reason) => blockers.push({ gate, status, reason });

  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    addBlocker('evidence', 'missing', 'Provide a production activation evidence file.');
  } else {
    if (evidence.schema !== ACTIVATION_SCHEMA) addBlocker('schema', 'invalid', 'Evidence schema is not recognized.');
    if (evidence.environment !== 'production') addBlocker('environment', 'invalid', 'Evidence must be for production.');
    if (!shaLike(evidence.releaseSha)) {
      addBlocker('releaseSha', 'invalid', 'Evidence must identify the exact release digest.');
    }
    if (!shaLike(options.expectedReleaseSha)) {
      addBlocker('expectedReleaseSha', 'missing', 'Set the deployed AVRONE_RELEASE_SHA.');
    } else if (!shaLike(evidence.releaseSha) || evidence.releaseSha.toLowerCase() !== options.expectedReleaseSha.toLowerCase()) {
      addBlocker('releaseSha', 'mismatch', 'Evidence does not match the deployed release.');
    }

    const issuedAt = strictUtcTimestamp(evidence.issuedAt);
    const expiresAt = strictUtcTimestamp(evidence.expiresAt);
    if (issuedAt === null || expiresAt === null) {
      addBlocker('evidenceTime', 'invalid', 'Issue and expiry timestamps must use explicit UTC (Z or +00:00).');
    } else {
      if (issuedAt > nowMs + 5 * 60 * 1000) addBlocker('issuedAt', 'future', 'Evidence issue time is too far in the future.');
      if (nowMs - issuedAt > maxAgeMs) addBlocker('issuedAt', 'stale', 'Evidence is older than the 24-hour validity window.');
      if (expiresAt <= nowMs) addBlocker('expiresAt', 'expired', 'Activation evidence has expired.');
      if (expiresAt <= issuedAt || expiresAt - issuedAt > maxAgeMs) {
        addBlocker('evidenceLifetime', 'invalid', 'Evidence validity must be positive and no longer than 24 hours.');
      }
    }

    const checks = evidence.checks && typeof evidence.checks === 'object' && !Array.isArray(evidence.checks)
      ? evidence.checks : {};
    for (const [id, label] of REQUIRED_GATES) {
      const item = checks[id];
      const observedAt = strictUtcTimestamp(item && item.observedAt);
      const reference = typeof (item && item.reference) === 'string' ? item.reference.trim() : '';
      const fresh = observedAt !== null && observedAt <= nowMs + 5 * 60 * 1000 && nowMs - observedAt <= maxAgeMs;
      let status = 'missing';
      let reason = 'No positive evidence was provided.';
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        if (item.passed === false) {
          status = 'failed';
          reason = 'The check explicitly failed.';
        } else if (item.passed !== true) {
          status = 'invalid';
          reason = 'The result must be the boolean true.';
        } else if (reference.length < 4) {
          status = 'missing-reference';
          reason = 'Provide a reviewable evidence reference.';
        } else if (!fresh) {
          status = 'stale-or-invalid-time';
          reason = 'Evidence time is missing, invalid, future-dated, or older than 24 hours.';
        } else {
          status = 'passed';
          reason = 'Evidence is present and fresh; a reviewer must still inspect it.';
        }
      }
      gates[id] = { label, status, referencePresent: reference.length >= 4, fresh };
      if (status !== 'passed') addBlocker(id, status, reason);
    }
  }

  const ready = blockers.length === 0;
  return Object.freeze({
    schema: 'avrone.activation-readiness/v1',
    decision: ready ? 'ENABLE_EXECUTION' : 'SAFE_PREVIEW_ONLY',
    previewEnabled: true,
    executionEnabled: ready,
    readinessOnly: true,
    evaluatedAt: new Date(nowMs).toISOString(),
    evidenceMaxAgeHours: maxAgeMs / (60 * 60 * 1000),
    passed: Object.values(gates).filter(item => item.status === 'passed').length,
    required: REQUIRED_GATES.length,
    gates,
    blockers,
    note: ready
      ? 'All evidence gates are present and fresh. This is a readiness decision only; deployment controls and independent human review are still required.'
      : 'Execution remains disabled. Resolve every blocker and reevaluate; safe preview remains available.'
  });
}

export default evaluateActivation;
