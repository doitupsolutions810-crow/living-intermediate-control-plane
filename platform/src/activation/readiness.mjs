/**
 * Thin platform adapter over the canonical AVRONE activation decision.
 *
 * Policy (timestamps, exact-release binding, evidence freshness, and the eight
 * criteria) lives in the root status/activation-gate.mjs module. This adapter
 * only shapes that canonical result for platform callers; it never deploys,
 * starts workers, enables a runtime flag, or writes evidence.
 */
import {
  ACTIVATION_SCHEMA as CANONICAL_SCHEMA,
  MAX_EVIDENCE_AGE_MS as CANONICAL_MAX_AGE,
  REQUIRED_CHECKS as CANONICAL_CHECKS,
  evaluateActivation as evaluateCanonicalActivation
} from '../../../status/activation-gate.mjs';

export const ACTIVATION_SCHEMA = CANONICAL_SCHEMA;
export const MAX_EVIDENCE_AGE_MS = CANONICAL_MAX_AGE;
export const REQUIRED_GATES = Object.freeze(
  CANONICAL_CHECKS.map(([id, label]) => Object.freeze([id, label]))
);

const MISSING_STATUSES = new Set([
  'missing', 'missing-reference', 'stale-or-invalid-time', 'stale'
]);

function globalBlocker(reason) {
  if (reason.startsWith('Activation evidence file is missing')) return { gate: 'evidence', status: 'missing', reason };
  if (reason === 'Evidence schema is not recognized.') return { gate: 'schema', status: 'invalid', reason };
  if (reason === 'Evidence must name the production environment.') return { gate: 'environment', status: 'invalid', reason };
  if (reason.startsWith('Evidence must identify the exact release')) return { gate: 'releaseSha', status: 'invalid', reason };
  if (reason.startsWith('AVRONE_RELEASE_SHA must identify')) return { gate: 'expectedReleaseSha', status: 'missing', reason };
  if (reason.startsWith('Activation evidence is for a different release')) return { gate: 'releaseSha', status: 'mismatch', reason };
  if (reason.startsWith('Evidence issue and expiry times')) return { gate: 'evidenceTime', status: 'invalid', reason };
  if (reason === 'Evidence issue time is in the future.') return { gate: 'issuedAt', status: 'future', reason };
  if (reason === 'Activation evidence has expired.') return { gate: 'expiresAt', status: 'expired', reason };
  if (reason.startsWith('Evidence validity must be positive')) return { gate: 'evidenceLifetime', status: 'invalid', reason };
  if (reason.startsWith('Activation evidence is older than')) return { gate: 'issuedAt', status: 'stale', reason };
  return { gate: 'activation', status: 'blocked', reason };
}

function statusFor(item, check) {
  if (check?.passed === true) return 'passed';
  if (!item || typeof item !== 'object' || Array.isArray(item)) return 'missing';
  if (item.passed === false) return 'failed';
  if (item.passed !== true) return 'invalid';
  if (!check?.referencePresent) return 'missing-reference';
  if (!check?.fresh) return 'stale-or-invalid-time';
  return 'failed';
}

/**
 * Evaluate evidence with the canonical runtime gate.
 * input: { evidence }, options: { nowMs?, maxAgeMs?, expectedReleaseSha? }.
 * READY_FOR_OPERATOR_APPROVAL means the evidence gate is satisfied.
 * This adapter never enables execution; runtime controls remain separate.
 */
export function evaluateActivation(input = {}, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? MAX_EVIDENCE_AGE_MS;
  if (!Number.isFinite(nowMs) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || maxAgeMs > MAX_EVIDENCE_AGE_MS) {
    throw new TypeError('nowMs and maxAgeMs must be finite, with maxAgeMs between 1 ms and 24 hours');
  }

  const validInput = input !== null && typeof input === 'object' && !Array.isArray(input);
  const evidence = validInput ? input.evidence ?? null : null;
  const canonical = evaluateCanonicalActivation({
    mode: 'live',
    evidence,
    now: new Date(nowMs),
    expectedReleaseSha: options.expectedReleaseSha ?? null,
    maxAgeMs
  });

  const checkResults = new Map((canonical.checks || []).map(item => [item.id, item]));
  const rawChecks = evidence?.checks && typeof evidence.checks === 'object' && !Array.isArray(evidence.checks)
    ? evidence.checks : {};
  const gates = {};
  const blockers = [];

  if (!validInput) {
    blockers.push({ gate: 'input', status: 'invalid', reason: 'Input must be an object containing activation evidence.' });
  }

  for (const [id, label] of REQUIRED_GATES) {
    const raw = rawChecks[id];
    const result = checkResults.get(id);
    const status = statusFor(raw, result);
    const matchingReason = (canonical.blockers || []).find(reason => reason.startsWith(label + ': '));
    gates[id] = {
      label,
      status,
      referencePresent: result?.referencePresent === true,
      fresh: result?.fresh === true
    };
    if (status !== 'passed') {
      blockers.push({
        gate: id,
        status,
        reason: matchingReason ? matchingReason.slice(label.length + 2) : 'Required evidence is not confirmed.'
      });
    }
  }

  const gatePrefixes = REQUIRED_GATES.map(([, label]) => label + ': ');
  for (const reason of canonical.blockers || []) {
    if (gatePrefixes.some(prefix => reason.startsWith(prefix))) continue;
    blockers.push(globalBlocker(reason));
  }

  const ready = validInput && canonical.liveExecutionAllowed === true && blockers.length === 0;
  const missingGates = blockers.filter(item => MISSING_STATUSES.has(item.status)).map(item => item.gate);
  const failedGates = blockers.filter(item => !MISSING_STATUSES.has(item.status)).map(item => item.gate);

  return Object.freeze({
    schema: 'avrone.activation-readiness/v1',
    decision: ready ? 'READY_FOR_OPERATOR_APPROVAL' : 'SAFE_PREVIEW_ONLY',
    previewEnabled: true,
    executionEnabled: false,
    readyForOperatorApproval: ready,
    readinessOnly: true,
    evaluatedAt: new Date(nowMs).toISOString(),
    evidenceMaxAgeHours: maxAgeMs / (60 * 60 * 1000),
    passed: REQUIRED_GATES.filter(([id]) => gates[id]?.status === 'passed').length,
    required: REQUIRED_GATES.length,
    gates,
    failedGates,
    missingGates,
    blockers,
    note: ready
      ? 'All evidence gates are fresh and match this release. This is a readiness decision only; deployment controls and independent human approval are still required.'
      : 'Execution remains disabled. Resolve every blocker and reevaluate; safe preview remains available.'
  });
}

export default evaluateActivation;
