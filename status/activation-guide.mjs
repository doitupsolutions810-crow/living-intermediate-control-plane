#!/usr/bin/env node
/** Plain-language, read-only activation guide. Never changes runtime switches or evidence. */
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const GUIDE_CHECKS = Object.freeze([
  ['ciPassed', 'Build and automated checks passed', 'Open the CI run for this exact release. Confirm a runner started, all steps ran, and the result is green.'],
  ['postgresIntegrationPassed', 'Real PostgreSQL integration passed', 'Connect a disposable PostgreSQL 16 test database and run the actual integration suite. Do not use production data.'],
  ['tenantIsolationPassed', 'Tenant separation was verified', 'Run cross-tenant read, write, and worker-claim tests; confirm each unauthorized action is rejected.'],
  ['stagingSecurityReviewPassed', 'Staging security review was approved', 'Have a reviewer check TLS, access controls, network exposure, logs, and secret handling in staging.'],
  ['backupRestorePassed', 'Backup and restore were tested', 'Restore a recent backup into an isolated environment and verify the restored data and application behavior.'],
  ['workerIdentityVerified', 'Worker identity and rotation were verified', 'Confirm worker credentials are scoped, unexpired, and rotation/revocation has been tested.'],
  ['executorHealthPassed', 'The approved executor passed its health check', 'Configure the approved HTTPS model endpoint in the secret manager and run the non-production health probe.'],
  ['operatorApproved', 'An authorized operator approved this exact release', 'After the seven technical checks pass, record an authorized human approval for the exact release digest.']
]);

export function buildGuide({ liveDecision = {}, requestedMode = 'preview', requiredChecks = GUIDE_CHECKS } = {}) {
  const checkResults = new Map((Array.isArray(liveDecision.checks) ? liveDecision.checks : []).map(item => [item.id, item]));
  const items = requiredChecks.map(([id, label, action]) => {
    const result = checkResults.get(id);
    const passed = Boolean(result && result.passed === true && result.referencePresent === true && result.fresh === true);
    return { id, label, status: passed ? 'PASS' : 'ACTION NEEDED', action: passed ? 'Evidence is marked present and fresh; a reviewer must still inspect the evidence itself.' : action };
  });
  const passed = items.filter(item => item.status === 'PASS').length;
  const next = items.find(item => item.status !== 'PASS');
  const evidenceComplete = passed === items.length && liveDecision.liveExecutionAllowed === true;
  return {
    title: 'AVRONE — plain-language activation guide',
    recommendedMode: 'PREVIEW (safe default)',
    configuredMode: String(requestedMode || 'preview').toLowerCase(),
    evidenceDecision: evidenceComplete ? 'EVIDENCE COMPLETE — RUNTIME SETTINGS AND HUMAN REVIEW STILL REQUIRED' : 'NO-GO — LIVE ACTIVATION IS NOT APPROVED',
    passed,
    required: items.length,
    progress: String(passed) + '/' + String(items.length) + ' checks confirmed by the evidence evaluator',
    nextAction: next ? next.label + ': ' + next.action : 'Review all eight evidence references independently, confirm the deployed release digest, and authorize activation through the deployment controls. This guide never enables execution.',
    checks: items,
    safetyBoundary: 'Read-only guide: it does not enable workers, change environment variables, create evidence, call the external executor, or write production data.'
  };
}

function readEvidence(path) {
  if (!path || !existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function main() {
  const args = process.argv.slice(2);
  const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
  const evidencePath = value('--evidence') || process.env.AVRONE_ACTIVATION_EVIDENCE_FILE || '';
  const mode = value('--mode') || process.env.AVRONE_ACTIVATION_MODE || 'preview';
  import('./activation-gate.mjs').then(({ evaluateActivation, REQUIRED_CHECKS }) => {
    const evidence = readEvidence(evidencePath);
    const expectedReleaseSha = process.env.AVRONE_RELEASE_SHA || null;
    // Evaluate live readiness for reporting only. No runtime flag is modified and no execution is started.
    const liveDecision = evaluateActivation({ mode: 'live', evidence, expectedReleaseSha });
    const requiredChecks = REQUIRED_CHECKS.map(([id, label]) => {
      const fallback = GUIDE_CHECKS.find(item => item[0] === id);
      return [id, label, fallback ? fallback[2] : 'Review the evidence for this check.'];
    });
    const report = buildGuide({ liveDecision, requestedMode: mode, requiredChecks });
    console.log(JSON.stringify(report, null, 2));
  }).catch(() => {
    console.log(JSON.stringify(buildGuide({ requestedMode: mode }), null, 2));
    process.exitCode = 2;
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
