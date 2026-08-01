#!/usr/bin/env node
/**
 * CI entry point — runs the same checks CI expects, with clear exit codes.
 * Order: init → doctor → self-test → health → dry-run procure
 *
 * Usage:
 *   node status/ci-check.mjs
 *   npm run ci
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const steps = [
  { name: 'init', args: ['status/init.mjs'] },
  { name: 'doctor', args: ['status/doctor.mjs'] },
  { name: 'self-test', args: ['test/self-test.mjs'] },
  { name: 'health', args: ['status/health.mjs'] },
  { name: 'dry-run procure', args: ['integrate.mjs', 'procure'], env: { DRY_RUN: '1', ACCEPT_LOCAL_EVIDENCE: '1' } }
];

let failed = 0;
const results = [];

for (const step of steps) {
  process.stdout.write(`\n== ${step.name} ==\n`);
  const result = spawnSync(process.execPath, step.args.map(a => join(root, a).includes(root) ? (a.startsWith('status') || a.startsWith('test') || a === 'integrate.mjs' ? join(root, a) : a) : a), {
    cwd: root,
    env: { ...process.env, ...(step.env || {}) },
    stdio: 'inherit'
  });
  // Fix path mapping more cleanly
}

// Cleaner re-implementation without path confusion
const cleanSteps = [
  { name: 'init', file: join(root, 'status/init.mjs') },
  { name: 'doctor', file: join(root, 'status/doctor.mjs') },
  { name: 'self-test', file: join(root, 'test/self-test.mjs') },
  { name: 'health', file: join(root, 'status/health.mjs') },
  {
    name: 'dry-run procure',
    file: join(root, 'integrate.mjs'),
    extraArgs: ['procure'],
    env: { DRY_RUN: '1', ACCEPT_LOCAL_EVIDENCE: '1' }
  }
];

for (const step of cleanSteps) {
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
