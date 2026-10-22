#!/usr/bin/env node
/**
 * Low-technicality activation gate. Preview is safe by default; live execution
 * requires fresh, referenced, operator-reviewed evidence from all required gates.
 * This tool never flips runtime switches or creates evidence on its own.
 */
import { existsSync, readFileSync } from 'node:fs';

export const ACTIVATION_SCHEMA = 'avrone.activation-evidence/v1';
export const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;
export const REQUIRED_CHECKS = Object.freeze([
  ['ciPassed', 'Build and automated checks passed'],
  ['postgresIntegrationPassed', 'Real PostgreSQL integration test passed'],
  ['tenantIsolationPassed', 'Tenant separation was verified'],
  ['stagingSecurityReviewPassed', 'Staging security review was approved'],
  ['backupRestorePassed', 'Backup and restore were tested'],
  ['workerIdentityVerified', 'Worker identities and rotation were verified'],
  ['executorHealthPassed', 'The approved executor answered its health check'],
  ['operatorApproved', 'An authorized operator approved live execution']
]);

function timestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateActivation({ mode = 'preview', evidence = null, now = new Date() } = {}) {
  const requestedMode = String(mode || 'preview').toLowerCase();
  const at = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(at)) throw new TypeError('now must be a valid date');

  if (requestedMode === 'preview') {
    return {
      schema: 'avrone.activation-decision/v1',
      decision: 'SAFE_PREVIEW',
      requestedMode,
      liveExecutionAllowed: false,
      passed: 0,
      required: REQUIRED_CHECKS.length,
      blockers: ['Live execution remains off in preview mode.'],
      enabledCapabilities: ['local health checks', 'read-only review', 'dry-run planning'],
      blockedCapabilities: ['live worker execution', 'external tool writes', 'production budget mutations'],
      note: 'Preview mode is safe to use for review; it does not prove production readiness.'
    };
  }

  const blockers = [];
  const checks = [];
  if (requestedMode !== 'live') blockers.push('Mode must be preview or live.');
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    blockers.push('Activation evidence file is missing or is not an object.');
  } else {
    if (evidence.schema !== ACTIVATION_SCHEMA) blockers.push('Evidence schema is not recognized.');
    if (evidence.environment !== 'production') blockers.push('Evidence must name the production environment.');
    if (typeof evidence.releaseSha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(evidence.releaseSha)) {
      blockers.push('Evidence must identify the exact release with a Git or SHA-256 digest.');
    }
    const issuedAt = timestamp(evidence.issuedAt);
    const expiresAt = timestamp(evidence.expiresAt);
    if (issuedAt === null || expiresAt === null) {
      blockers.push('Evidence issue and expiry times must be valid timestamps.');
    } else {
      if (issuedAt > at + 5 * 60 * 1000) blockers.push('Evidence issue time is in the future.');
      if (expiresAt <= at) blockers.push('Activation evidence has expired.');
      if (expiresAt <= issuedAt || expiresAt - issuedAt > MAX_EVIDENCE_AGE_MS) {
        blockers.push('Evidence validity must be positive and no longer than 24 hours.');
      }
      if (at - issuedAt > MAX_EVIDENCE_AGE_MS) blockers.push('Activation evidence is older than 24 hours.');
    }
    const values = evidence.checks && typeof evidence.checks === 'object' && !Array.isArray(evidence.checks)
      ? evidence.checks : {};
    for (const [id, label] of REQUIRED_CHECKS) {
      const item = values[id];
      const observedAt = timestamp(item && item.observedAt);
      const reference = typeof (item && item.reference) === 'string' ? item.reference.trim() : '';
      const fresh = observedAt !== null && observedAt <= at + 5 * 60 * 1000 && at - observedAt <= MAX_EVIDENCE_AGE_MS;
      const passed = Boolean(item && item.passed === true && reference.length >= 4 && fresh);
      if (!passed) {
        let reason = 'not confirmed';
        if (!item || item.passed !== true) reason = 'not marked passed';
        else if (reference.length < 4) reason = 'evidence reference missing';
        else if (!fresh) reason = 'evidence missing, future-dated, or older than 24 hours';
        blockers.push(label + ': ' + reason + '.');
      }
      checks.push({ id, label, passed, referencePresent: reference.length >= 4, fresh });
    }
  }

  const liveExecutionAllowed = blockers.length === 0;
  return {
    schema: 'avrone.activation-decision/v1',
    decision: liveExecutionAllowed ? 'LIVE_APPROVED' : 'BLOCKED',
    requestedMode,
    liveExecutionAllowed,
    passed: checks.filter(function (item) { return item.passed; }).length,
    required: REQUIRED_CHECKS.length,
    checks,
    blockers,
    enabledCapabilities: liveExecutionAllowed
      ? ['approved live worker execution within existing policy controls']
      : ['local health checks', 'read-only review', 'dry-run planning'],
    blockedCapabilities: liveExecutionAllowed
      ? []
      : ['live worker execution', 'external tool writes', 'production budget mutations'],
    note: 'This gate evaluates operator evidence; it cannot independently verify a pasted link or replace production monitoring.'
  };
}

function readEvidence(path) {
  if (!path || !existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function main() {
  const args = process.argv.slice(2);
  function value(name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
  }
  const mode = value('--mode') || process.env.AVRONE_ACTIVATION_MODE || 'preview';
  const evidencePath = value('--evidence') || process.env.AVRONE_ACTIVATION_EVIDENCE_FILE || '';
  const result = evaluateActivation({ mode, evidence: readEvidence(evidencePath) });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.decision === 'BLOCKED' ? 2 : 0);
}

if (process.argv[1] && new URL('file://' + process.argv[1]).href === import.meta.url) main();
