#!/usr/bin/env node
/**
 * Post-pull upgrade check — verify critical files for current release line
 */

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
  'config.json',
  'bin/plane.mjs',
  'status/daily-loop.mjs',
  'status/doctor.mjs',
  'status/checklist.mjs',
  'status/security-scan.mjs',
  'status/cosign-sign.mjs',
  'status/rekor-cli.mjs',
  'status/upgrade-check.mjs',
  'policy/trivy-results.rego',
  'policy/snyk-results.rego',
  'Dockerfile',
  'trivy.yaml',
  'docs/upgrade.md',
  'docs/daily-loop.md',
  'docs/cosign.md',
  'docs/jq-cheatsheet.md',
  '.github/workflows/plane-ci.yml'
];

const optional = [
  'k8s/gatekeeper',
  'docs/systemd/plane-daily.service',
  'docs/systemd/plane-daily.timer',
  'docs/systemd-debug.md'
];

const results = [];
let failed = 0;

for (const rel of required) {
  const ok = existsSync(join(root, rel));
  results.push({ path: rel, required: true, ok });
  if (!ok) failed++;
}

for (const rel of optional) {
  results.push({ path: rel, required: false, ok: existsSync(join(root, rel)) });
}

const summary = {
  timestamp: new Date().toISOString(),
  version,
  ok: failed === 0,
  failed,
  passed: results.filter(r => r.ok).length,
  results,
  next: failed === 0
    ? ['plane doctor', 'plane checklist', 'plane daily']
    : ['git pull --ff-only origin main', 'plane upgrade-check'],
  note: failed === 0
    ? 'Upgrade check passed. Critical files for this release line are present.'
    : 'Upgrade check failed. Re-pull main or restore missing files.'
};

console.log(JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
