/**
 * Fail-closed activation gate for AVRONE CONTROL12.
 * Evaluates fresh evidence only; it never connects services or starts workers.
 */
export const REQUIRED_GATES = Object.freeze([
  'postgresConnected',
  'schemaCurrent',
  'postgresIntegrationPassed',
  'stagingSecurityReviewPassed',
  'workerCredentialConfigured',
  'executorConnected',
  'rollbackTestPassed',
  'operatorApproved'
]);

const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;

function isFreshIsoTimestamp(value, nowMs, maxAgeMs) {
  if (typeof value !== 'string' || value.length === 0) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const age = nowMs - timestamp;
  return age >= 0 && age <= maxAgeMs;
}

/**
 * Input: { evidence: { gateName: { passed: true, verifiedAt: ISO8601 } } }
 * Only literal true plus a fresh timestamp satisfies a gate.
 */
export function evaluateActivation(input, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? MAX_EVIDENCE_AGE_MS;
  const evidence = input && typeof input === 'object' && !Array.isArray(input)
    ? input.evidence : null;
  const blockers = [];
  const gates = {};

  for (const name of REQUIRED_GATES) {
    const item = evidence && typeof evidence === 'object' ? evidence[name] : null;
    let status = 'missing';
    if (item && typeof item === 'object' && item.passed === true) {
      status = isFreshIsoTimestamp(item.verifiedAt, nowMs, maxAgeMs)
        ? 'passed' : 'stale-or-invalid-evidence';
    } else if (item && typeof item === 'object' && item.passed === false) {
      status = 'failed';
    } else if (item && typeof item === 'object' && item.passed !== undefined) {
      status = 'invalid-evidence';
    }
    gates[name] = status;
    if (status !== 'passed') blockers.push({ gate: name, status });
  }

  const executionEnabled = blockers.length === 0;
  return Object.freeze({
    decision: executionEnabled ? 'ENABLE_EXECUTION' : 'SAFE_PREVIEW_ONLY',
    previewEnabled: true,
    executionEnabled,
    evaluatedAt: new Date(nowMs).toISOString(),
    evidenceMaxAgeHours: maxAgeMs / (60 * 60 * 1000),
    gates,
    blockers,
    note: executionEnabled
      ? 'All required evidence is fresh. This is a readiness decision, not a deployment action.'
      : 'Execution remains disabled. Resolve every blocker and reevaluate; preview remains available.'
  });
}

export default evaluateActivation;
