#!/usr/bin/env node
/** Unified progress board — 0.10.0 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { readPlaneState } from './plane-state.mjs';
import { isAuthorized, readSession } from '../agents/llama/session.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

function readJson(name) {
  const p = join(dataDir, name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {}

const readiness = emitReadinessEvidence({ source: 'progress' });
const plan = evaluateQuorum(createOrchestrationPlan('progress'));
const planeState = readPlaneState();
const agentOk = isAuthorized(root);
const session = readSession(root);

const unattended = readJson('unattended-last.json');
const admit = readJson('admit-change-last.json');
const daily = readJson('daily-loop-last.json');
const selfDev = readJson('self-develop-last.json');
const supply = readJson('supply-chain-last.json');

const board = {
  timestamp: new Date().toISOString(),
  version,
  milestone: '0.10.0-control-plane',
  plane: {
    paused: planeState.paused,
    readiness: readiness.overallDecision,
    orchestration: plan.overallDecision
  },
  agent: {
    authorized: agentOk,
    expiresAt: session?.expiresAt || null,
    policy: 'Use agent-chat only for workspace/ toolkit work'
  },
  supplyChain: supply
    ? { ok: supply.ok, at: supply.timestamp, imageRef: supply.imageRef || null }
    : null,
  lastRuns: {
    unattended: unattended ? { ok: unattended.ok, at: unattended.timestamp } : null,
    admitChange: admit ? { ok: admit.ok, at: admit.timestamp } : null,
    daily: daily ? { ok: daily.ok, at: daily.timestamp } : null,
    selfDevelop: selfDev ? { ok: selfDev.ok, at: selfDev.timestamp } : null
  },
  ops: {
    snkyToken: 'Set GitHub secret SNYK_TOKEN for hard CI Snyk',
    ghcrCosign: 'Confirm on main push — docs/ci-registry-cosign.md',
    timer: 'docs/timer-copy-paste.md',
    gitsign: 'optional — docs/gitsign.md',
    sigstore: 'docs/sigstore-ecosystem.md'
  },
  successCriteria: [
    '1. Readiness is READY',
    '2. Evidence is available (public or local accepted)',
    '3. Supply-chain enforcement remains active'
  ],
  suggested: !planeState.paused && readiness.overallDecision === 'READY'
    ? ['plane unattended', 'plane supply-chain', 'plane admit-change']
    : ['plane doctor', 'plane progress', 'plane resume']
};

console.log(JSON.stringify(board, null, 2));
const healthy =
  !planeState.paused &&
  readiness.overallDecision === 'READY' &&
  plan.overallDecision === 'READY';
process.exit(healthy ? 0 : 1);
