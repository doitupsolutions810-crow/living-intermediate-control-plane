#!/usr/bin/env node
/**
 * Doctor — diagnose plane health and basic integrity
 * Checks modules, config, data directory writability, and core READY signals.
 * Control704 high-priority override surface
 */

import { existsSync, accessSync, constants, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const checks = [];

function check(name, fn) {
  try {
    const detail = fn() || 'ok';
    checks.push({ name, ok: true, detail });
  } catch (err) {
    checks.push({ name, ok: false, detail: String(err.message || err) });
  }
}

check('package.json readable', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  return `version ${pkg.version}`;
});

check('config.json loadable', async () => {
  const { loadConfig } = await import('../lib/config.mjs');
  const cfg = loadConfig();
  return `securityValue=${cfg.securityValue}`;
});

check('data directory writable', () => {
  const dataDir = join(root, 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const probe = join(dataDir, '.write-probe');
  writeFileSync(probe, 'ok', 'utf8');
  accessSync(probe, constants.R_OK | constants.W_OK);
  unlinkSync(probe);
  return dataDir;
});

check('readiness module', async () => {
  const { emitReadinessEvidence } = await import('../lattice/readiness-poller.mjs');
  const ev = emitReadinessEvidence({ source: 'doctor' });
  if (ev.overallDecision !== 'READY') throw new Error(`readiness=${ev.overallDecision}`);
  return ev.provider;
});

check('orchestration module', async () => {
  const { createOrchestrationPlan, evaluateQuorum } = await import('../agents/orchestration.mjs');
  const plan = evaluateQuorum(createOrchestrationPlan('doctor'));
  if (plan.overallDecision !== 'READY') throw new Error(`orchestration=${plan.overallDecision}`);
  return `${plan.roles.length} roles`;
});

check('LaunchDesk actions', async () => {
  const { handleLaunchDeskAction, listNamedActions } = await import('../launchdesk/actions.mjs');
  const named = listNamedActions();
  const action = handleLaunchDeskAction('status', 'doctor');
  if (!action.accepted) throw new Error('status action not accepted');
  return `${named.length} named actions`;
});

check('plane state readable', async () => {
  const { readPlaneState } = await import('./plane-state.mjs');
  const state = readPlaneState();
  return state.paused ? 'paused' : 'active';
});

// Run async checks sequentially
(async () => {
  // Re-run async ones properly
  const asyncChecks = checks.filter(c => c.detail instanceof Promise || false);
  // Simpler: redo critical async imports in sequence
  const final = [];

  function add(name, ok, detail) {
    final.push({ name, ok, detail });
  }

  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    add('package.json readable', true, `version ${pkg.version}`);
  } catch (e) {
    add('package.json readable', false, String(e.message || e));
  }

  try {
    const { loadConfig } = await import('../lib/config.mjs');
    const cfg = loadConfig();
    add('config loadable', true, `securityValue=${cfg.securityValue}`);
  } catch (e) {
    add('config loadable', false, String(e.message || e));
  }

  try {
    const dataDir = join(root, 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    const probe = join(dataDir, '.write-probe');
    writeFileSync(probe, 'ok', 'utf8');
    unlinkSync(probe);
    add('data directory writable', true, dataDir);
  } catch (e) {
    add('data directory writable', false, String(e.message || e));
  }

  try {
    const { emitReadinessEvidence } = await import('../lattice/readiness-poller.mjs');
    const ev = emitReadinessEvidence({ source: 'doctor' });
    add('readiness READY', ev.overallDecision === 'READY', ev.provider);
  } catch (e) {
    add('readiness READY', false, String(e.message || e));
  }

  try {
    const { createOrchestrationPlan, evaluateQuorum } = await import('../agents/orchestration.mjs');
    const plan = evaluateQuorum(createOrchestrationPlan('doctor'));
    add('orchestration READY', plan.overallDecision === 'READY', `${plan.roles.length} roles`);
  } catch (e) {
    add('orchestration READY', false, String(e.message || e));
  }

  try {
    const { handleLaunchDeskAction, listNamedActions } = await import('../launchdesk/actions.mjs');
    const named = listNamedActions();
    const action = handleLaunchDeskAction('status', 'doctor');
    add('LaunchDesk actions', action.accepted === true, `${named.length} named actions`);
  } catch (e) {
    add('LaunchDesk actions', false, String(e.message || e));
  }

  try {
    const { readPlaneState } = await import('./plane-state.mjs');
    const state = readPlaneState();
    add('plane state readable', true, state.paused ? 'paused' : 'active');
  } catch (e) {
    add('plane state readable', false, String(e.message || e));
  }

  const failed = final.filter(c => !c.ok);
  const result = {
    timestamp: new Date().toISOString(),
    ok: failed.length === 0,
    passed: final.filter(c => c.ok).length,
    failed: failed.length,
    checks: final,
    securityValue: 'High',
    note: failed.length === 0
      ? 'Doctor checks passed under Control704 override.'
      : 'One or more doctor checks failed.'
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
})();
