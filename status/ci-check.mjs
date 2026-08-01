#!/usr/bin/env node
/**
 * CI entry point
 * Order: init → doctor → self-test → health → dry-run procure → security-scan (optional skip)
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const steps = [
  { name: 'init', file: join(root, 'status/init.mjs') },
  { name: 'doctor', file: join(root, 'status/doctor.mjs') },
  { name: 'self-test', file: join(root, 'test/self-test.mjs') },
  { name: 'health', file: join(root, 'status/health.mjs') },
  {
    name: 'dry-run procure',
    file: join(root, 'integrate.mjs'),
    extraArgs: ['procure'],
    env: { DRY_RUN: '1', ACCEPT_LOCAL_EVIDENCE: '1' }
  },
  {
    name: 'security-scan (Trivy + OPA)',
    file: join(root, 'status/security-scan.mjs'),
    // In local/default CI without tools installed, allow skip; GitHub job still runs native Trivy actions
    env: { ALLOW_SKIP: process.env.REQUIRE_SECURITY_TOOLS === '1' ? '0' : '1' }
  }
];

let failed = 0;
const results = [];

for (const step of steps) {
  process.stdout.write(`\n== ${step.name} ==\n`);
  const args = [step.file, ...(step.extraArgs || [])];
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...(step.env || {}) },
    stdio: 'inherit'
  });
  const ok = result.status === 0;
  results.push({ name: step.name, ok, status: result.status });
  if (!ok) failed++;
}

const summary = {
  timestamp: new Date().toISOString(),
  ok: failed === 0,
  passed: results.filter(r => r.ok).length,
  failed,
  results,
  note: failed === 0 ? 'CI checks passed.' : 'One or more CI checks failed.'
};

console.log('\n' + JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
