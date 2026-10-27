#!/usr/bin/env node
/**
 * Procurement bridge — fail-closed decision surface.
 * Procurement requires core readiness, authorized evidence, and current
 * revision-bound supply-chain evidence. Operator force flags cannot bypass any gate.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { probeEvidenceConsole } from '../lib/evidence-console.mjs';
import { acceptsLocalEvidence, isEvidenceAuthorized } from '../lib/evidence-authorization.mjs';
import { evaluateSupplyChainEvidence } from '../lib/supply-chain-evidence.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readiness = emitReadinessEvidence();
const plan = evaluateQuorum(createOrchestrationPlan('procurement-check'));

const evidenceConsole = await probeEvidenceConsole({ acceptLocal: true });
const localEvidenceAuthority = acceptsLocalEvidence({ env: process.env });
const evidenceAuthorized = isEvidenceAuthorized({
  status: evidenceConsole.status,
  authority: evidenceConsole.authority,
  localOptIn: localEvidenceAuthority
});

function currentRevision() {
  const supplied = (process.env.GITHUB_SHA || '').trim();
  if (supplied) return supplied;
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function readSupplyChainReport() {
  const reportPath = join(root, 'data', 'supply-chain-last.json');
  if (!existsSync(reportPath)) return null;
  try {
    return JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    return null;
  }
}

const supplyChainEvidence = evaluateSupplyChainEvidence({
  report: readSupplyChainReport(),
  revision: currentRevision()
});

const criteria = {
  readinessReady: readiness.overallDecision === 'READY' && readiness.failedGates.length === 0,
  rolesReady: plan.overallDecision === 'READY',
  supplyChainEvidenceAuthorized: supplyChainEvidence.authorized,
  supplyChainEvidenceReason: supplyChainEvidence.reason,
  localEvidenceAccepted: localEvidenceAuthority,
  evidenceAuthorized,
  evidenceStatus: evidenceConsole.status,
  evidenceAuthority: evidenceConsole.authority
};

const allCoreMet = criteria.readinessReady && criteria.rolesReady && criteria.supplyChainEvidenceAuthorized;
const procurementDecision = allCoreMet && evidenceAuthorized
  ? 'READY_FOR_PROCUREMENT'
  : 'HOLD_EVIDENCE_CONTROL';

const result = {
  timestamp: new Date().toISOString(),
  decision: procurementDecision,
  criteria,
  readiness,
  orchestration: {
    overall: plan.overallDecision,
    failedGates: plan.failedGates
  },
  note: procurementDecision === 'READY_FOR_PROCUREMENT'
    ? 'Core readiness, explicitly authorized evidence, and fresh revision-bound supply-chain evidence passed.'
    : 'HOLD: core readiness, authorized evidence, and fresh revision-bound supply-chain evidence are all required; FORCE_PROCUREMENT cannot bypass these gates.',
  securityValue: 'High'
};

console.log(JSON.stringify(result, null, 2));
