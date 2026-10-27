#!/usr/bin/env node
/**
 * Procurement bridge — fail-closed decision surface.
 * Procurement requires core readiness, authorized evidence, and current
 * revision-bound supply-chain evidence. Operator force flags cannot bypass any gate.
 */
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { probeEvidenceConsole } from '../lib/evidence-console.mjs';
import { acceptsLocalEvidence, authorizeProcurement } from '../lib/evidence-authorization.mjs';
import { loadSupplyChainEvidence } from '../lib/supply-chain-runtime.mjs';

const readiness = emitReadinessEvidence();
const plan = evaluateQuorum(createOrchestrationPlan('procurement-check'));

const evidenceConsole = await probeEvidenceConsole({ acceptLocal: true });
const localEvidenceAuthority = acceptsLocalEvidence({ env: process.env });
// Public trust additionally requires the independently validated v5.3.1
// status/schema contract; the full core decision is computed below.

const supplyChainEvidence = loadSupplyChainEvidence();
const reportAttestationVerified = supplyChainEvidence.reportAttestationVerified;

const criteria = {
  readinessReady: readiness.overallDecision === 'READY' && readiness.failedGates.length === 0,
  rolesReady: plan.overallDecision === 'READY',
  supplyChainEvidenceAuthorized: supplyChainEvidence.authorized,
  supplyChainEvidenceReason: supplyChainEvidence.reason,
  supplyChainReportAttestationVerified: reportAttestationVerified,
  localEvidenceAccepted: localEvidenceAuthority,
  evidenceStatus: evidenceConsole.status,
  evidenceAuthority: evidenceConsole.authority,
  trustContractVerified: evidenceConsole.trustContractVerified === true
};

const allCoreMet = criteria.readinessReady && criteria.rolesReady && criteria.supplyChainEvidenceAuthorized;
const evidenceAuthorization = authorizeProcurement({
  coreReady: allCoreMet,
  evidenceStatus: evidenceConsole.status,
  evidenceAuthority: evidenceConsole.authority,
  trustContractVerified: evidenceConsole.trustContractVerified === true,
  localEvidenceAccepted: localEvidenceAuthority
});
criteria.evidenceAuthorized = evidenceAuthorization.evidenceAuthorized;
criteria.authorizationReason = evidenceAuthorization.reason;
const procurementDecision = evidenceAuthorization.authorized
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
