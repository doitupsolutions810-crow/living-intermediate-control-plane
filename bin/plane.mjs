#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const commands = {
  help: { desc: 'Show this help' },
  progress: { script: 'status/progress.mjs', desc: 'Progress board (0.10 milestone)' },
  connectors: { script: 'status/connectors.mjs', desc: 'Connectors registry' },
  'supply-chain': { script: 'status/supply-chain.mjs', desc: 'Integrated supply-chain' },
  'notify-hints': { script: 'status/notify-hints.mjs', desc: 'Optional Drive/Gmail hints' },
  'operator-host': { script: 'scripts/install-operator-host.sh', shell: true, desc: 'Install unattended timer helpers' },
  init: { script: 'status/init.mjs', desc: 'Init local data' },
  checklist: { script: 'status/checklist.mjs', desc: 'Pre-flight' },
  daily: { script: 'status/daily-loop.mjs', desc: 'Daily loop' },
  unattended: { script: 'status/unattended.mjs', desc: 'Unattended loop' },
  'self-develop': { script: 'status/self-develop.mjs', desc: 'Auto workspace tasks' },
  'admit-change': { script: 'status/admit-change.mjs', desc: 'Admit under gates' },
  'agent-chat': { script: 'agents/llama/agent.mjs', args: ['chat'], desc: 'Llama chat auth' },
  'agent-run': { script: 'agents/llama/agent.mjs', args: ['run'], desc: 'Llama one-shot' },
  'agent-status': { script: 'agents/llama/agent.mjs', args: ['status'], desc: 'Agent session' },
  'agent-revoke': { script: 'agents/llama/agent.mjs', args: ['revoke'], desc: 'Revoke session' },
  'upgrade-check': { script: 'status/upgrade-check.mjs', desc: 'Post-pull files' },
  'verify-changes': { script: 'status/verify-changes.mjs', desc: 'Layout verify' },
  next: { script: 'status/next.mjs', desc: 'Next commands' },
  procure: {
    script: 'integrate.mjs',
    args: ['procure'],
    env: { ACCEPT_LOCAL_EVIDENCE: '1' },
    desc: 'Procure'
  },
  'procure-gated': {
    script: 'integrate.mjs',
    args: ['procure'],
    env: { ACCEPT_LOCAL_EVIDENCE: '1', GATE_DOCTOR: '1' },
    desc: 'Gated procure'
  },
  'dry-run': {
    script: 'integrate.mjs',
    args: ['procure'],
    env: { ACCEPT_LOCAL_EVIDENCE: '1', DRY_RUN: '1' },
    desc: 'Dry-run'
  },
  doctor: { script: 'status/doctor.mjs', desc: 'Doctor' },
  health: { script: 'status/health.mjs', desc: 'Health' },
  snapshot: { script: 'status/snapshot.mjs', desc: 'Snapshot' },
  report: { script: 'status/report.mjs', desc: 'Report' },
  metrics: { script: 'status/metrics.mjs', desc: 'Metrics' },
  last: { script: 'status/last.mjs', desc: 'Last decision' },
  log: { script: 'status/decision-log.mjs', desc: 'Decision log' },
  pause: { script: 'integrate.mjs', args: ['pause'], desc: 'Pause' },
  resume: { script: 'integrate.mjs', args: ['resume'], desc: 'Resume' },
  state: { script: 'status/plane-state.mjs', desc: 'State' },
  'security-scan': { script: 'status/security-scan.mjs', desc: 'Security scan' },
  'security-summary': { script: 'status/security-summary.mjs', desc: 'Security summary' },
  info: { script: 'status/info.mjs', desc: 'Info' },
  ci: { script: 'status/ci-check.mjs', desc: 'Local CI' },
  test: { script: 'test/self-test.mjs', desc: 'Self-test' },
  'cosign-sign': { script: 'status/cosign-sign.mjs', desc: 'Cosign sign' },
  'cosign-verify': { script: 'status/cosign-verify.mjs', desc: 'Cosign verify' },
  rekor: { script: 'status/rekor-cli.mjs', desc: 'Rekor CLI' }
};

const cmd = process.argv[2] || 'help';
const extra = process.argv.slice(3);

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log('Living Intermediate Control Plane CLI (0.10)\n');
  for (const name of Object.keys(commands).sort()) {
    console.log(`  ${name.padEnd(18)} ${commands[name].desc}`);
  }
  process.exit(0);
}

const def = commands[cmd];
if (!def) {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}

if (def.shell) {
  const result = spawnSync('bash', [join(root, def.script), ...extra], {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  });
  process.exit(result.status === 0 ? 0 : result.status || 1);
}

const result = spawnSync(
  process.execPath,
  [join(root, def.script), ...(def.args || []), ...extra],
  { cwd: root, env: { ...process.env, ...(def.env || {}) }, stdio: 'inherit' }
);
process.exit(result.status === 0 ? 0 : result.status || 1);
