#!/usr/bin/env node
/**
 * Local Trivy + OPA/Conftest integration
 *
 * Runs:
 *   1. Trivy FS scan (trivy.yaml)
 *   2. Optional Trivy image scan if IMAGE_REF is set
 *   3. Conftest/OPA on Trivy JSON when a report is produced
 *
 * Exit codes:
 *   0 — scans passed (or tools missing and ALLOW_SKIP=1)
 *   1 — findings / policy deny / tool failure
 *   2 — required tools missing and ALLOW_SKIP not set
 *
 * Env:
 *   IMAGE_REF     — image to scan (e.g. living-intermediate-control-plane:0.4.1)
 *   ALLOW_SKIP=1  — if trivy/conftest not installed, skip instead of failing
 *   SKIP_OPA=1    — run Trivy only
 *   SKIP_TRIVY=1  — run OPA only against existing report file
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
const skipOpa = process.env.SKIP_OPA === '1';
const skipTrivy = process.env.SKIP_TRIVY === '1';
const imageRef = process.env.IMAGE_REF || '';

function hasCmd(cmd) {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
  return r.status === 0 || (r.stdout || r.stderr || '').length > 0;
}

function run(cmd, args, opts = {}) {
  process.stdout.write(`\n$ ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    ...opts
  });
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
      console.error('[security-scan] trivy not installed. Install Trivy or set ALLOW_SKIP=1');
    }
  } else {
    const fsArgs = ['fs', '--config', trivyConfig, '--format', 'json', '--output', reportPath, '.'];
    const fsOk = run('trivy', fsArgs);
    results.push({ step: 'trivy-fs', ok: fsOk, report: reportPath });
    if (!fsOk) failed++;

    // Human-readable table as well
    run('trivy', ['fs', '--config', trivyConfig, '--format', 'table', '.']);

    if (imageRef) {
      const imgJson = join(dataDir, 'trivy-image-report.json');
      const imgOk = run('trivy', [
        'image',
        '--config', trivyConfig,
        '--format', 'json',
        '--output', imgJson,
        imageRef
      ]);
      results.push({ step: 'trivy-image', ok: imgOk, report: imgJson, image: imageRef });
      if (!imgOk) failed++;
      run('trivy', ['image', '--config', trivyConfig, '--format', 'table', imageRef]);
      // Prefer image report for OPA when present
      if (imgOk && existsSync(imgJson)) {
        writeFileSync(reportPath, readFileSync(imgJson, 'utf8'));
      }
    }
  }
}

// ── OPA / Conftest ───────────────────────────────────────────────────
if (!skipOpa) {
  if (!hasCmd('conftest')) {
    if (allowSkip) {
      results.push({ step: 'opa-conftest', ok: true, skipped: true, detail: 'conftest not installed' });
      console.error('[security-scan] conftest not found — skipped (ALLOW_SKIP=1)');
    } else if (!existsSync(reportPath)) {
      results.push({ step: 'opa-conftest', ok: true, skipped: true, detail: 'no trivy report to evaluate' });
    } else {
      results.push({ step: 'opa-conftest', ok: false, detail: 'conftest not installed' });
      failed++;
      console.error('[security-scan] conftest not installed. Install Conftest or set ALLOW_SKIP=1');
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
  config: {
    trivyConfig: existsSync(trivyConfig),
    policyDir: existsSync(policyDir),
    imageRef: imageRef || null,
    allowSkip,
    skipTrivy,
    skipOpa
  },
  note: failed === 0
    ? 'Trivy + OPA policy integration passed.'
    : 'One or more security scan / policy steps failed.'
};

console.log('\n' + JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
