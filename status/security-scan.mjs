#!/usr/bin/env node
/**
 * Trivy + Snyk (app + container) + OPA/Conftest
 *
 * Env:
 *   IMAGE_REF              image for Trivy image + Snyk container scan
 *   ALLOW_SKIP=1           skip missing tools
 *   SKIP_TRIVY=1 / SKIP_SNYK=1 / SKIP_OPA=1
 *   SKIP_SNYK_CONTAINER=1  skip only container scan
 *   SNYK_TOKEN             or prior `snyk auth`
 */

import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const trivyReport = join(dataDir, 'trivy-report.json');
const snykReport = join(dataDir, 'snyk-test.json');
const snykContainerReport = join(dataDir, 'snyk-container.json');
const trivyConfig = join(root, 'trivy.yaml');
const policyDir = join(root, 'policy');
const snykPolicy = join(root, 'policy/snyk-results.rego');

const allowSkip = process.env.ALLOW_SKIP === '1' || process.env.ALLOW_SKIP === 'true';
const skipTrivy = process.env.SKIP_TRIVY === '1';
const skipSnyk = process.env.SKIP_SNYK === '1';
const skipSnykContainer = process.env.SKIP_SNYK_CONTAINER === '1';
const skipOpa = process.env.SKIP_OPA === '1';
const imageRef = process.env.IMAGE_REF || '';

function hasCmd(cmd) {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
  return r.status === 0 || (r.stdout || r.stderr || '').length > 0;
}

function run(cmd, args) {
  process.stdout.write(`\n$ ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  return r.status === 0;
}

const results = [];
let failed = 0;

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// ── Trivy ───────────────────────────────────────────────────────────
if (!skipTrivy) {
  if (!hasCmd('trivy')) {
    if (allowSkip) {
      results.push({ step: 'trivy', ok: true, skipped: true });
      console.error('[security-scan] trivy not found — skipped');
    } else {
      results.push({ step: 'trivy', ok: false, detail: 'not installed' });
      failed++;
    }
  } else {
    const fsOk = run('trivy', ['fs', '--config', trivyConfig, '--format', 'json', '--output', trivyReport, '.']);
    results.push({ step: 'trivy-fs', ok: fsOk });
    if (!fsOk) failed++;
    run('trivy', ['fs', '--config', trivyConfig, '--format', 'table', '.']);

    if (imageRef) {
      const imgJson = join(dataDir, 'trivy-image-report.json');
      const imgOk = run('trivy', ['image', '--config', trivyConfig, '--format', 'json', '--output', imgJson, imageRef]);
      results.push({ step: 'trivy-image', ok: imgOk, image: imageRef });
      if (!imgOk) failed++;
      run('trivy', ['image', '--config', trivyConfig, '--format', 'table', imageRef]);
      if (imgOk && existsSync(imgJson)) writeFileSync(trivyReport, readFileSync(imgJson, 'utf8'));
    }
  }
}

// ── Snyk open-source + container ───────────────────────────────────────
if (!skipSnyk) {
  if (!hasCmd('snyk')) {
    if (allowSkip) {
      results.push({ step: 'snyk', ok: true, skipped: true });
      console.error('[security-scan] snyk not found — skipped');
    } else {
      results.push({ step: 'snyk', ok: false, detail: 'not installed' });
      failed++;
    }
  } else {
    // App / dependency scan
    const codeOk = run('snyk', [
      'test',
      '--severity-threshold=high',
      `--json-file-output=${snykReport}`
    ]);
    results.push({ step: 'snyk-test', ok: codeOk });
    if (!codeOk) failed++;

    // Container scan (integrated)
    if (imageRef && !skipSnykContainer) {
      const cArgs = [
        'container',
        'test',
        imageRef,
        '--severity-threshold=high',
        `--json-file-output=${snykContainerReport}`
      ];
      const cOk = run('snyk', cArgs);
      results.push({
        step: 'snyk-container',
        ok: cOk,
        image: imageRef,
        report: snykContainerReport
      });
      if (!cOk) failed++;

      // Human-readable summary (non-JSON)
      run('snyk', ['container', 'test', imageRef, '--severity-threshold=high']);
    } else if (!imageRef) {
      results.push({
        step: 'snyk-container',
        ok: true,
        skipped: true,
        detail: 'set IMAGE_REF to enable Snyk container scan'
      });
    }
  }
}

// ── OPA on Trivy + Snyk JSON ─────────────────────────────────────────
if (!skipOpa) {
  if (!hasCmd('conftest')) {
    if (allowSkip) {
      results.push({ step: 'opa-conftest', ok: true, skipped: true });
      console.error('[security-scan] conftest not found — skipped');
    } else {
      results.push({ step: 'opa-conftest', ok: false, detail: 'not installed' });
      failed++;
    }
  } else {
    if (existsSync(trivyReport)) {
      const ok = run('conftest', ['test', '--policy', policyDir, trivyReport]);
      results.push({ step: 'opa-trivy', ok });
      if (!ok) failed++;
    }
    if (existsSync(snykReport)) {
      const ok = run('conftest', ['test', '--policy', snykPolicy, snykReport]);
      results.push({ step: 'opa-snyk', ok });
      if (!ok) failed++;
    }
    if (existsSync(snykContainerReport)) {
      const ok = run('conftest', ['test', '--policy', snykPolicy, snykContainerReport]);
      results.push({ step: 'opa-snyk-container', ok });
      if (!ok) failed++;
    }
  }
}

const summary = {
  timestamp: new Date().toISOString(),
  ok: failed === 0,
  failed,
  results,
  integration: {
    trivy: !skipTrivy,
    snyk: !skipSnyk,
    snykContainer: Boolean(imageRef) && !skipSnyk && !skipSnykContainer,
    opa: !skipOpa,
    imageRef: imageRef || null
  },
  note: failed === 0
    ? 'Security scan passed (or allowed skips).'
    : 'One or more security steps failed.'
};

console.log('\n' + JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
