#!/usr/bin/env node
/**
 * Local security integration: Trivy + Snyk + OPA/Conftest
 *
 * Order:
 *   1. Trivy FS (and optional image if IMAGE_REF set)
 *   2. Snyk open-source / container (if installed + SNYK_TOKEN)
 *   3. Conftest/OPA on Trivy JSON report
 *
 * Env:
 *   IMAGE_REF              container image for Trivy image + Snyk container
 *   ALLOW_SKIP=1           skip missing tools instead of failing
 *   SKIP_TRIVY=1           skip Trivy
 *   SKIP_SNYK=1            skip Snyk
 *   SKIP_OPA=1             skip Conftest
 *   SNYK_TOKEN             required for authenticated Snyk (or prior snyk auth)
 *   REQUIRE_SECURITY_TOOLS=1  used by ci-check to force tools
 */

import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const reportPath = join(dataDir, 'trivy-report.json');
const trivyConfig = join(root, 'trivy.yaml');
const policyDir = join(root, 'policy');

const allowSkip = process.env.ALLOW_SKIP === '1' || process.env.ALLOW_SKIP === 'true';
const skipTrivy = process.env.SKIP_TRIVY === '1';
const skipSnyk = process.env.SKIP_SNYK === '1';
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
      results.push({ step: 'trivy', ok: true, skipped: true, detail: 'trivy not installed' });
      console.error('[security-scan] trivy not found — skipped (ALLOW_SKIP=1)');
    } else {
      results.push({ step: 'trivy', ok: false, detail: 'trivy not installed' });
      failed++;
    }
  } else {
    const fsOk = run('trivy', ['fs', '--config', trivyConfig, '--format', 'json', '--output', reportPath, '.']);
    results.push({ step: 'trivy-fs', ok: fsOk, report: reportPath });
    if (!fsOk) failed++;
    run('trivy', ['fs', '--config', trivyConfig, '--format', 'table', '.']);

    if (imageRef) {
      const imgJson = join(dataDir, 'trivy-image-report.json');
      const imgOk = run('trivy', ['image', '--config', trivyConfig, '--format', 'json', '--output', imgJson, imageRef]);
      results.push({ step: 'trivy-image', ok: imgOk, report: imgJson, image: imageRef });
      if (!imgOk) failed++;
      run('trivy', ['image', '--config', trivyConfig, '--format', 'table', imageRef]);
      if (imgOk && existsSync(imgJson)) {
        writeFileSync(reportPath, readFileSync(imgJson, 'utf8'));
      }
    }
  }
}

// ── Snyk (complements Trivy) ────────────────────────────────────────
if (!skipSnyk) {
  if (!hasCmd('snyk')) {
    if (allowSkip) {
      results.push({ step: 'snyk', ok: true, skipped: true, detail: 'snyk not installed' });
      console.error('[security-scan] snyk not found — skipped (ALLOW_SKIP=1)');
    } else {
      results.push({ step: 'snyk', ok: false, detail: 'snyk not installed' });
      failed++;
    }
  } else {
    // Open-source / manifest scan (package.json). --severity-threshold=high aligns with Trivy gate.
    const codeArgs = ['test', '--severity-threshold=high', '--json-file-output=' + join(dataDir, 'snyk-test.json')];
    const codeOk = run('snyk', codeArgs);
    // Snyk exits non-zero when vulns found — treat as scan result
    results.push({ step: 'snyk-test', ok: codeOk, report: join(dataDir, 'snyk-test.json') });
    if (!codeOk) failed++;

    if (imageRef) {
      const containerOk = run('snyk', [
        'container',
        'test',
        imageRef,
        '--severity-threshold=high',
        '--json-file-output=' + join(dataDir, 'snyk-container.json')
      ]);
      results.push({ step: 'snyk-container', ok: containerOk, image: imageRef });
      if (!containerOk) failed++;
    }
  }
}

// ── OPA / Conftest on Trivy JSON ─────────────────────────────────────
if (!skipOpa) {
  if (!hasCmd('conftest')) {
    if (allowSkip) {
      results.push({ step: 'opa-conftest', ok: true, skipped: true, detail: 'conftest not installed' });
      console.error('[security-scan] conftest not found — skipped (ALLOW_SKIP=1)');
    } else if (!existsSync(reportPath)) {
      results.push({ step: 'opa-conftest', ok: true, skipped: true, detail: 'no trivy report' });
    } else {
      results.push({ step: 'opa-conftest', ok: false, detail: 'conftest not installed' });
      failed++;
    }
  } else if (!existsSync(reportPath)) {
    results.push({ step: 'opa-conftest', ok: false, detail: 'missing trivy JSON report' });
    failed++;
  } else {
    const opaOk = run('conftest', ['test', '--policy', policyDir, reportPath]);
    results.push({ step: 'opa-conftest', ok: opaOk, policy: policyDir, report: reportPath });
    if (!opaOk) failed++;
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
    opa: !skipOpa,
    imageRef: imageRef || null
  },
  note: failed === 0
    ? 'Trivy + Snyk + OPA integration passed (or allowed skips).'
    : 'One or more security steps failed.'
};

console.log('\n' + JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
