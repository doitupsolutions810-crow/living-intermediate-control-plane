#!/usr/bin/env node
/**
 * Local security integration: Trivy + Snyk + OPA/Conftest (Trivy + Snyk Rego)
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
      results.push({ step: 'trivy-image', ok: imgOk });
      if (!imgOk) failed++;
      run('trivy', ['image', '--config', trivyConfig, '--format', 'table', imageRef]);
      if (imgOk && existsSync(imgJson)) writeFileSync(trivyReport, readFileSync(imgJson, 'utf8'));
    }
  }
}

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
    const codeOk = run('snyk', ['test', '--severity-threshold=high', `--json-file-output=${snykReport}`]);
    results.push({ step: 'snyk-test', ok: codeOk });
    if (!codeOk) failed++;
    if (imageRef) {
      const cOk = run('snyk', ['container', 'test', imageRef, '--severity-threshold=high', `--json-file-output=${snykContainerReport}`]);
      results.push({ step: 'snyk-container', ok: cOk });
      if (!cOk) failed++;
    }
  }
}

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
    if (!existsSync(trivyReport) && !existsSync(snykReport) && !existsSync(snykContainerReport)) {
      results.push({ step: 'opa', ok: true, skipped: true, detail: 'no reports to evaluate' });
    }
  }
}

const summary = {
  timestamp: new Date().toISOString(),
  ok: failed === 0,
  failed,
  results,
  note: failed === 0
    ? 'Trivy + Snyk + OPA (Trivy & Snyk Rego) passed or skipped.'
    : 'One or more security / policy steps failed.'
};

console.log('\n' + JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
