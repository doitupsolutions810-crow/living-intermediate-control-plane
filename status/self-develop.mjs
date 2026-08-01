#!/usr/bin/env node
/**
 * Self-develop runner — allowlisted steps only
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const tasksDir = join(root, 'workspace/tasks');
const dataDir = join(root, 'data');
const outPath = join(dataDir, 'self-develop-last.json');

const STEP_MAP = {
  'upgrade-check': { file: 'status/upgrade-check.mjs' },
  'verify-changes': { file: 'status/verify-changes.mjs' },
  doctor: { file: 'status/doctor.mjs' },
  'self-test': { file: 'test/self-test.mjs' },
  checklist: { file: 'status/checklist.mjs' },
  health: { file: 'status/health.mjs' },
  'security-scan': { file: 'status/security-scan.mjs' },
  'supply-chain': { file: 'status/supply-chain.mjs' },
  'admit-change': { file: 'status/admit-change.mjs' },
  metrics: { file: 'status/metrics.mjs' },
  'security-summary': { file: 'status/security-summary.mjs' },
  daily: { file: 'status/daily-loop.mjs' },
  init: { file: 'status/init.mjs' }
};

const continueOnFail = process.env.SELF_DEVELOP_CONTINUE_ON_FAIL === '1';

function runStep(name, env = {}) {
  const def = STEP_MAP[name];
  if (!def) return { name, ok: false, detail: `unknown step: ${name}` };
  process.stdout.write(`\n-- step: ${name} --\n`);
  const r = spawnSync(process.execPath, [join(root, def.file)], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit'
  });
  return { name, ok: r.status === 0, status: r.status };
}

function loadTasks() {
  if (!existsSync(tasksDir)) return [];
  return readdirSync(tasksDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        return { file: f, ...JSON.parse(readFileSync(join(tasksDir, f), 'utf8')) };
      } catch (e) {
        return { file: f, id: f, error: String(e.message || e), auto: false };
      }
    })
    .filter(t => t.enabled !== false && t.auto === true && !t.error);
}

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const tasks = loadTasks();
const taskResults = [];
let failed = 0;

process.stdout.write(`\n======== self-develop (${tasks.length} auto tasks) ========\n`);

for (const task of tasks) {
  process.stdout.write(`\n==== task: ${task.id || task.file} ====\n`);
  const stepResults = [];
  let taskFailed = 0;
  const steps = Array.isArray(task.steps) ? task.steps : [];
  const env = task.env && typeof task.env === 'object' ? task.env : {};

  for (const step of steps) {
    const r = runStep(step, env);
    stepResults.push(r);
    if (!r.ok) {
      taskFailed++;
      if (!continueOnFail) break;
    }
  }

  const ok = taskFailed === 0 && steps.length > 0;
  if (!ok) failed++;
  taskResults.push({ id: task.id || task.file, type: task.type || null, ok, steps: stepResults });
  if (!ok && !continueOnFail) break;
}

const summary = {
  timestamp: new Date().toISOString(),
  ok: failed === 0,
  failed,
  tasksRun: taskResults.length,
  taskResults,
  allowlist: Object.keys(STEP_MAP),
  note: failed === 0 ? 'Self-develop auto tasks passed.' : 'Self-develop had failures.'
};

writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
console.log('\n' + JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
