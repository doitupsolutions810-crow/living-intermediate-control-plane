#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {}

const required = [
  'integrate.mjs',
  'bin/plane.mjs',
  'status/daily-loop.mjs',
  'status/unattended.mjs',
  'status/self-develop.mjs',
  'status/admit-change.mjs',
  'status/doctor.mjs',
  'status/checklist.mjs',
  'status/security-scan.mjs',
  'status/upgrade-check.mjs',
  'status/verify-changes.mjs',
  'agents/llama/agent.mjs',
  'agents/llama/toolkit.mjs',
  'agents/llama/session.mjs',
  'policy/trivy-results.rego',
  'policy/snyk-results.rego',
  'Dockerfile',
  'docs/unattended.md',
  'docs/llama-agent.md',
  '.github/workflows/plane-ci.yml'
];

const results = [];
let failed = 0;
for (const rel of required) {
  const ok = existsSync(join(root, rel));
  results.push({ path: rel, ok });
  if (!ok) failed++;
}

const summary = {
  timestamp: new Date().toISOString(),
  version,
  ok: failed === 0,
  failed,
  passed: results.filter(r => r.ok).length,
  results,
  next: failed === 0
    ? ['plane doctor', 'plane unattended', 'plane agent-status']
    : ['git pull --ff-only origin main', 'plane upgrade-check'],
  note: failed === 0 ? 'Upgrade check passed.' : 'Missing required files.'
};
console.log(JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
