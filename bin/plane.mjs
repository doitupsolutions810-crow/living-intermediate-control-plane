#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const commands = {
  help: { desc: 'Show this help' },
  init: { script: 'status/init.mjs', desc: 'Create local data dir and config' },
  checklist: { script: 'status/checklist.mjs', desc: 'Pre-flight before procure' },
  daily: { script: 'status/daily-loop.mjs', desc: 'Automated daily operator loop' },
  unattended: { script: 'status/unattended.mjs', desc: 'Unattended self-develop + gates' },
  'self-develop': { script: 'status/self-develop.mjs', desc: 'Run auto workspace tasks' },
  'upgrade-check': { script: 'status/upgrade-check.mjs', desc: 'Verify files after git pull' },
  'verify-changes': { script: 'status/verify-changes.mjs', desc: 'Verify docs/layout after changes' },
  next: { script: 'status/next.mjs', desc: 'Recommended next commands' },
  procure: {
    script: 'integrate.mjs',
    args: ['procure'],
    env: { ACCEPT_LOCAL_EVIDENCE: '1' },
    desc: 'Full check + accept local evidence'
  },
  'procure-gated': {
    script: 'integrate.mjs',
    args: ['procure'],
    env: { ACCEPT_LOCAL_EVIDENCE: '1', GATE_DOCTOR: '1' },
    desc: 'Procure only if doctor passes'
  },
  'dry-run': {
    script: 'integrate.mjs',
    args: ['procure'],
    env: { ACCEPT_LOCAL_EVIDENCE: '1', DRY_RUN: '1' },
    desc: 'Procure preview without recording'
  },
  doctor: { script: 'status/doctor.mjs', desc: 'Integrity diagnostics' },
  health: { script: 'status/health.mjs', desc: 'Exit 0 only when healthy' },
  snapshot: { script: 'status/snapshot.mjs', desc: 'State + recent decisions' },
  report: { script: 'status/report.mjs', desc: 'Human-readable report' },
  metrics: { script: 'status/metrics.mjs', desc: 'Decision outcome counts' },
  last: { script: 'status/last.mjs', desc: 'Most recent decision' },
  log: { script: 'status/decision-log.mjs', desc: 'Decision log + metrics' },
  pause: { script: 'integrate.mjs', args: ['pause'], desc: 'Pause the plane' },
  resume: { script: 'integrate.mjs', args: ['resume'], desc: 'Resume the plane' },
  state: { script: 'status/plane-state.mjs', desc: 'Show pause state' },
  'security-scan': { script: 'status/security-scan.mjs', desc: 'Trivy + Snyk + OPA' },
  'security-summary': { script: 'status/security-summary.mjs', desc: 'Supply-chain posture' },
  info: { script: 'status/info.mjs', desc: 'Version + success criteria' },
  ci: { script: 'status/ci-check.mjs', desc: 'Full local CI suite' },
  test: { script: 'test/self-test.mjs', desc: 'Self-test' },
  'cosign-sign': { script: 'status/cosign-sign.mjs', desc: 'Cosign sign + Rekor' },
  'cosign-verify': { script: 'status/cosign-verify.mjs', desc: 'Cosign verify' },
  rekor: { script: 'status/rekor-cli.mjs', desc: 'rekor-cli passthrough' }
};

const cmd = process.argv[2] || 'help';
const extra = process.argv.slice(3);

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log('Living Intermediate Control Plane CLI\n');
  console.log('Usage: plane <command>\n');
  for (const name of Object.keys(commands).sort()) {
    console.log(`  ${name.padEnd(18)} ${commands[name].desc}`);
  }
  console.log('\nUnattended: plane unattended');
  process.exit(0);
}

const def = commands[cmd];
if (!def) {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
if (!def.script) process.exit(0);

const result = spawnSync(
  process.execPath,
  [join(root, def.script), ...(def.args || []), ...extra],
  { cwd: root, env: { ...process.env, ...(def.env || {}) }, stdio: 'inherit' }
);
process.exit(result.status === 0 ? 0 : result.status || 1);
