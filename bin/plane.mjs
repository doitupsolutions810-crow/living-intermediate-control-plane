#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const commands = {
  help: { desc: 'Show this help' },
  connectors: { script: 'status/connectors.mjs', desc: 'Connectors, toolsets, skills registry' },
  progress: { script: 'status/progress.mjs', desc: 'Unified progress board' },
  'supply-chain': { script: 'status/supply-chain.mjs', desc: 'Integrated scan/policy/sign path' },
  init: { script: 'status/init.mjs', desc: 'Create local data dir and config' },
  checklist: { script: 'status/checklist.mjs', desc: 'Pre-flight before procure' },
  daily: { script: 'status/daily-loop.mjs', desc: 'Daily operator loop' },
  unattended: { script: 'status/unattended.mjs', desc: 'Unattended self-develop + gates' },
  'self-develop': { script: 'status/self-develop.mjs', desc: 'Run auto workspace tasks' },
  'admit-change': { script: 'status/admit-change.mjs', desc: 'Admit workspace changes under gates' },
  'agent-chat': { script: 'agents/llama/agent.mjs', args: ['chat'], desc: 'Llama chat + authorize toolkit' },
  'agent-run': { script: 'agents/llama/agent.mjs', args: ['run'], desc: 'Llama one-shot (session required)' },
  'agent-status': { script: 'agents/llama/agent.mjs', args: ['status'], desc: 'Agent session status' },
  'agent-revoke': { script: 'agents/llama/agent.mjs', args: ['revoke'], desc: 'Revoke agent session' },
  'upgrade-check': { script: 'status/upgrade-check.mjs', desc: 'Verify files after pull' },
  'verify-changes': { script: 'status/verify-changes.mjs', desc: 'Verify docs/layout' },
  next: { script: 'status/next.mjs', desc: 'Recommended next commands' },
  procure: {
    script: 'integrate.mjs',
    args: ['procure'],
    env: { ACCEPT_LOCAL_EVIDENCE: '1' },
    desc: 'Full check + local evidence'
  },
  'procure-gated': {
    script: 'integrate.mjs',
    args: ['procure'],
    env: { ACCEPT_LOCAL_EVIDENCE: '1', GATE_DOCTOR: '1' },
    desc: 'Procure if doctor passes'
  },
  'dry-run': {
    script: 'integrate.mjs',
    args: ['procure'],
    env: { ACCEPT_LOCAL_EVIDENCE: '1', DRY_RUN: '1' },
    desc: 'Procure preview'
  },
  doctor: { script: 'status/doctor.mjs', desc: 'Integrity diagnostics' },
  health: { script: 'status/health.mjs', desc: 'Healthy exit code' },
  snapshot: { script: 'status/snapshot.mjs', desc: 'State snapshot' },
  report: { script: 'status/report.mjs', desc: 'Human-readable report' },
  metrics: { script: 'status/metrics.mjs', desc: 'Decision metrics' },
  last: { script: 'status/last.mjs', desc: 'Last decision' },
  log: { script: 'status/decision-log.mjs', desc: 'Decision log' },
  pause: { script: 'integrate.mjs', args: ['pause'], desc: 'Pause plane' },
  resume: { script: 'integrate.mjs', args: ['resume'], desc: 'Resume plane' },
  state: { script: 'status/plane-state.mjs', desc: 'Pause state' },
  'security-scan': { script: 'status/security-scan.mjs', desc: 'Trivy + Snyk + OPA' },
  'security-summary': { script: 'status/security-summary.mjs', desc: 'Posture overview' },
  info: { script: 'status/info.mjs', desc: 'Version + criteria' },
  ci: { script: 'status/ci-check.mjs', desc: 'Local CI suite' },
  test: { script: 'test/self-test.mjs', desc: 'Self-test' },
  'cosign-sign': { script: 'status/cosign-sign.mjs', desc: 'Cosign sign' },
  'cosign-verify': { script: 'status/cosign-verify.mjs', desc: 'Cosign verify' },
  rekor: { script: 'status/rekor-cli.mjs', desc: 'rekor-cli passthrough' }
};

const cmd = process.argv[2] || 'help';
const extra = process.argv.slice(3);

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log('Living Intermediate Control Plane CLI\n');
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

const result = spawnSync(
  process.execPath,
  [join(root, def.script), ...(def.args || []), ...extra],
  { cwd: root, env: { ...process.env, ...(def.env || {}) }, stdio: 'inherit' }
);
process.exit(result.status === 0 ? 0 : result.status || 1);
