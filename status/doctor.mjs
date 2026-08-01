#!/usr/bin/env node
/**
 * Doctor — diagnose plane health and basic integrity
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

(async () => {
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

  // Supply-chain policy files (presence checks — not full scan)
  add('trivy policy present', existsSync(join(root, 'policy/trivy-results.rego')), 'policy/trivy-results.rego');
  add('snyk policy present', existsSync(join(root, 'policy/snyk-results.rego')), 'policy/snyk-results.rego');
  add('gatekeeper manifests present', existsSync(join(root, 'k8s/gatekeeper')), 'k8s/gatekeeper/');

  const failed = final.filter(c => !c.ok);
  const result = {
    timestamp: new Date().toISOString(),
    ok: failed.length === 0,
    passed: final.filter(c => c.ok).length,
    failed: failed.length,
    checks: final,
    securityValue: 'High',
    note: failed.length === 0
      ? 'Doctor checks passed.'
      : 'One or more doctor checks failed.'
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
})();
