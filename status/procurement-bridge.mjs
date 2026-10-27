#!/usr/bin/env node
/**
 * Procurement bridge — limited-technicality decision surface
 *
 * Emits a clear go / hold signal. Procurement readiness is independent of
 * production authorization. Force flags never authorize.
 * Local plane status can serve as temporary evidence authority only with
 * explicit ACCEPT_LOCAL_EVIDENCE=1 and cone compliance.
 */

import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { evaluateGateNamespaces } from '../lib/gate-namespaces.mjs';
import { probeEvidenceConsole } from '../lib/evidence-console.mjs';
import { loadConfig } from '../lib/config.mjs';
import { parseResidualCoordinate } from '../lib/residual-input.mjs';

const config = loadConfig();
const readiness = emitReadinessEvidence();
const plan = evaluateQuorum(createOrchestrationPlan('procurement-check'));

const coreReady =
  readiness.overallDecision === 'READY' &&
  readiness.failedGates.length === 0 &&
  plan.overallDecision === 'READY';

const residualInput = parseResidualCoordinate(process.env.GREAT_SCALE_S);
const residualS = residualInput.valid ? residualInput.value : -1; // sentinel only to force cone HOLD
const evidenceConsole = await probeEvidenceConsole({ acceptLocal: true });

const gates = evaluateGateNamespaces({
  coreReady,
  evidenceConsole,
  env: process.env,
  config,
  S: residualS,
  supplyChainOk: false,
  requireCone: true,
});

const procurementDecision = !residualInput.valid
  ? 'HOLD_INVALID_RESIDUAL'
  : !gates.procurement.coneCompliant
    ? 'HOLD_RESIDUAL_CONE'
    : gates.procurement.procurementReady
      ? 'READY_FOR_PROCUREMENT'
      : 'HOLD_EVIDENCE_CONTROL';

const result = {
  timestamp: new Date().toISOString(),
  decision: procurementDecision,
  residualInput: {
    valid: residualInput.valid,
    source: residualInput.source,
    supplied: process.env.GREAT_SCALE_S !== undefined,
    error: residualInput.error
  },
  residual: residualInput.valid ? gates.residual : null,
  evidenceConsole: {
    status: evidenceConsole.status,
    authority: evidenceConsole.authority,
    trustContractVerified: evidenceConsole.trustContractVerified === true,
    trustFailures: evidenceConsole.trustFailures || []
  },
  gateNamespaces: {
    procurement: gates.procurement,
    production: gates.production,
    invariant: gates.invariant,
  },
  readiness: {
    overall: readiness.overallDecision,
    failedGates: readiness.failedGates,
  },
  orchestration: {
    overall: plan.overallDecision,
    failedGates: plan.failedGates,
  },
  note: !residualInput.valid
    ? residualInput.error
    : !gates.procurement.coneCompliant
      ? 'Residual coordinate violates the Great Scale cone floor; procurement held.'
      : gates.procurement.note,
  securityValue: 'High',
  schema: 'great-scale.procurement-bridge/v1',
};

console.log(JSON.stringify(result, null, 2));
