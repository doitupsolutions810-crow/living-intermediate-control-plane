#!/usr/bin/env node
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

const paths = [
  'docs/verify-changes.md',
  'docs/unattended.md',
  'docs/llama-agent.md',
  'docs/operator-host-setup.md',
  'docs/cron/plane-daily.crontab',
  'docs/daily-loop.md',
  'agents/llama/agent.mjs',
  'agents/llama/toolkit.mjs',
  'agents/llama/session.mjs',
  'agents/llama/config.json',
  'status/unattended.mjs',
  'status/admit-change.mjs',
  'workspace/tasks/verify-health.json',
  'bin/plane.mjs'
];

for (const p of paths) check(`exists:${p}`, exists(p), p);

if (exists('docs/daily-loop.md')) {
  const daily = read('docs/daily-loop.md');
  check('daily-loop has no embedded crontab line', !/0\s+9\s+\*\s+\*\s+\*/.test(daily), 'cron');
  check('daily-loop points at cron template', daily.includes('docs/cron/plane-daily.crontab'), 'ref');
}

if (exists('docs/cron/plane-daily.crontab')) {
  const cron = read('docs/cron/plane-daily.crontab');
  check('cron template has schedule', /0\s+9\s+\*\s+\*\s+\*/.test(cron), 'schedule');
}

if (exists('agents/llama/toolkit.mjs')) {
  const tk = read('agents/llama/toolkit.mjs');
  check('toolkit confines writes to workspace', tk.includes('workspace') && tk.includes('escapes'), 'workspace-only');
}

if (exists('agents/llama/session.mjs')) {
  const s = read('agents/llama/session.mjs');
  check('session auth module present', s.includes('authorize') && s.includes('isAuthorized'), 'auth');
}

const failed = checks.filter(c => !c.ok);
const summary = {
  timestamp: new Date().toISOString(),
  version,
  ok: failed.length === 0,
  passed: checks.filter(c => c.ok).length,
  failed: failed.length,
  checks,
  note: failed.length === 0 ? 'verify-changes passed.' : 'verify-changes failed.'
};
console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
