#!/usr/bin/env node
/**
 * Unattended system loop — develop/maintain without a human at the keyboard.
 *
 * Sequence:
 *   1. init
 *   2. daily operator loop (checklist → procure → doctor → scan → metrics)
 *   3. self-develop auto tasks (workspace/tasks)
 *   4. final upgrade-check + verify-changes + doctor
 *
 * Env:
 *   UNATTENDED_CONTINUE_ON_FAIL=1
 *   DAILY_* / SELF_DEVELOP_* / ALLOW_SKIP — passed through
 *   UNATTENDED_SKIP_DAILY=1
 *   UNATTENDED_SKIP_SELF_DEVELOP=1
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const outPath = join(dataDir, 'unattended-last.json');

const continueOnFail = process.env.UNATTENDED_CONTINUE_ON_FAIL === '1';
const skipDaily = process.env.UNATTENDED_SKIP_DAILY === '1';
const skipSelf = process.env.UNATTENDED_SKIP_SELF_DEVELOP === '1';

function run(name, script, env = {}) {
  process.stdout.write(`\n======== ${name} ========\n`);
  const r = spawnSync(process.execPath, [join(root, script)], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit'
  });
  return { name, ok: r.status === 0, status: r.status };
}

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const results = [];
let failed = 0;

function push(r) {
  results.push(r);
  if (!r.ok) {
    failed++;
    return continueOnFail;
  }
  return true;
}

let go = true;
go = push(run('init', 'status/init.mjs')) && go;

if (!skipDaily && go) {
  go = push(run('daily', 'status/daily-loop.mjs', {
    ALLOW_SKIP: process.env.ALLOW_SKIP || '1'
  })) || continueOnFail;
}

if (!skipSelf && (go || continueOnFail)) {
  go = push(run('self-develop', 'status/self-develop.mjs', {
    SELF_DEVELOP_CONTINUE_ON_FAIL: process.env.SELF_DEVELOP_CONTINUE_ON_FAIL || '0',
    ALLOW_SKIP: process.env.ALLOW_SKIP || '1'
  })) || continueOnFail;
}

if (go || continueOnFail) {
  push(run('final-upgrade-check', 'status/upgrade-check.mjs'));
  push(run('final-verify-changes', 'status/verify-changes.mjs'));
  push(run('final-doctor', 'status/doctor.mjs'));
}

const summary = {
  timestamp: new Date().toISOString(),
  ok: failed === 0,
  failed,
  passed: results.filter(r => r.ok).length,
  results,
  mode: 'unattended',
  note: failed === 0
    ? 'Unattended loop completed — system maintained itself under plane gates.'
    : 'Unattended loop finished with failures — see data/unattended-last.json'
};

writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
console.log('\n' + JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
