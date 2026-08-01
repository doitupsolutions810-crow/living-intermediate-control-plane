#!/usr/bin/env node
/**
 * Pre-flight checklist before procure
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { readPlaneState } from './plane-state.mjs';
import { loadConfig } from '../lib/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const config = loadConfig();
const planeState = readPlaneState();
const readiness = emitReadinessEvidence({ source: 'checklist' });
const plan = evaluateQuorum(createOrchestrationPlan('checklist'));

const items = [
  {
    id: 'not_paused',
    ok: !planeState.paused,
    detail: planeState.paused ? `paused: ${planeState.reason || 'yes'}` : 'active'
  },
  {
    id: 'readiness_ready',
    ok: readiness.overallDecision === 'READY',
    detail: readiness.overallDecision
  },
  {
    id: 'orchestration_ready',
    ok: plan.overallDecision === 'READY',
    detail: `${plan.roles.filter(r => r.status === 'READY').length}/${plan.roles.length} roles`
  },
  {
    id: 'trivy_policy',
    ok: existsSync(join(root, 'policy/trivy-results.rego')),
    detail: 'policy/trivy-results.rego'
  },
  {
    id: 'snyk_policy',
    ok: existsSync(join(root, 'policy/snyk-results.rego')),
    detail: 'policy/snyk-results.rego'
  },
  {
    id: 'dockerfile',
    ok: existsSync(join(root, 'Dockerfile')),
    detail: 'Dockerfile'
  },
  {
    id: 'config',
    ok: true,
    detail: `gateDoctorOnProcure=${config.gateDoctorOnProcure === true}`
  }
];

const failed = items.filter(i => !i.ok);
const readyToProcure = failed.length === 0;

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  readyToProcure,
  passed: items.filter(i => i.ok).length,
  failed: failed.length,
  items,
  next: readyToProcure
    ? 'npm run procure'
    : planeState.paused
      ? 'npm run resume'
      : 'npm run doctor',
  securityValue: config.securityValue
}, null, 2));

process.exit(readyToProcure ? 0 : 1);
