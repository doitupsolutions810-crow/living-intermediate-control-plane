#!/usr/bin/env node
/**
 * Verify layout/docs expectations after recent changes
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function exists(rel) {
  return existsSync(join(root, rel));
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

let version = 'unknown';
try {
  version = JSON.parse(read('package.json')).version;
} catch {}

// Required paths
const paths = [
  'docs/verify-changes.md',
  'docs/upgrade.md',
  'docs/operator-host-setup.md',
  'docs/cron/plane-daily.crontab',
  'docs/daily-loop.md',
  'docs/systemd/plane-daily.service',
  'docs/systemd/plane-daily.timer',
  'scripts/install-operator-host.sh',
  'status/daily-loop.mjs',
  'status/upgrade-check.mjs',
  'bin/plane.mjs'
];

for (const p of paths) {
  check(`exists:${p}`, exists(p), p);
}

// Cron single-source: daily-loop should not embed a full 09:00 cron line
if (exists('docs/daily-loop.md')) {
  const daily = read('docs/daily-loop.md');
  const hasCronLine = /0\s+9\s+\*\s+\*\s+\*/.test(daily);
  check('daily-loop has no embedded crontab line', !hasCronLine, hasCronLine ? 'found 0 9 * * *' : 'clean');
  check('daily-loop points at cron template', daily.includes('docs/cron/plane-daily.crontab'), 'reference');
}

// Cron template should define the schedule
if (exists('docs/cron/plane-daily.crontab')) {
  const cron = read('docs/cron/plane-daily.crontab');
  check('cron template has schedule', /0\s+9\s+\*\s+\*\s+\*/.test(cron), '0 9 * * *');
  check('cron template runs daily-loop', cron.includes('daily-loop.mjs') || cron.includes('npm run daily'), 'command');
}

// operator-host-setup should mention single source
if (exists('docs/operator-host-setup.md')) {
  const oh = read('docs/operator-host-setup.md');
  check('operator-host mentions cron template', oh.includes('docs/cron/plane-daily.crontab'), 'reference');
}

const failed = checks.filter(c => !c.ok);
const summary = {
  timestamp: new Date().toISOString(),
  version,
  ok: failed.length === 0,
  passed: checks.filter(c => c.ok).length,
  failed: failed.length,
  checks,
  note: failed.length === 0
    ? 'verify-changes passed.'
    : 'verify-changes failed — see checks with ok:false.'
};

console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
