#!/usr/bin/env node
/**
 * Admit agent/workspace changes under plane gates (same bar as CI slice)
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

const steps = [
  'status/upgrade-check.mjs',
  'status/verify-changes.mjs',
  'status/doctor.mjs',
  'test/self-test.mjs',
  'status/checklist.mjs',
  'status/security-scan.mjs'
];

const results = [];
let failed = 0;

for (const file of steps) {
  const name = file.split('/').pop();
  process.stdout.write(`\n== admit: ${name} ==\n`);
  const r = spawnSync(process.execPath, [join(root, file)], {
    cwd: root,
    env: { ...process.env, ALLOW_SKIP: process.env.ALLOW_SKIP || '1' },
    stdio: 'inherit'
  });
  const ok = r.status === 0;
  results.push({ name, ok });
  if (!ok) failed++;
}

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
const summary = {
  timestamp: new Date().toISOString(),
  ok: failed === 0,
  failed,
  results,
  note: failed === 0
    ? 'Change admitted by plane gates. CI must still pass on push.'
    : 'Admission failed — agent work not cleared.'
};
writeFileSync(join(dataDir, 'admit-change-last.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
