import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateProcurementReadiness,
  evaluateProductionAuthorization,
  evaluateGateNamespaces,
  EVIDENCE_GATES,
  PRODUCTION_GATES
} from '../lib/gate-namespaces.mjs';

const publicVerified = {
  status: 'ok',
  authority: 'public',
  trustContractVerified: true
};

test('HTTP 200 without a verified status/schema contract is not public authority', () => {
  const result = evaluateProcurementReadiness({
    coreReady: true,
    evidenceConsole: { status: 'ok', authority: 'public' },
    env: {},
    config: {},
    S: 0,
    requireCone: false
  });
  assert.equal(result.publicEvidenceOk, false);
  assert.equal(result.evidenceAuthorized, false);
  assert.equal(result.procurementReady, false);
});

test('explicitly false trustContractVerified blocks a public 200', () => {
  const result = evaluateProcurementReadiness({
    coreReady: true,
    evidenceConsole: { status: 'ok', authority: 'public', trustContractVerified: false },
    env: {},
    config: {},
    S: 0,
    requireCone: false
  });
  assert.equal(result.evidenceAuthorized, false);
  assert.equal(result.procurementReady, false);
});

test('verified public contract and core readiness permit procurement readiness', () => {
  const result = evaluateProcurementReadiness({
    coreReady: true,
    evidenceConsole: publicVerified,
    env: {},
    config: {},
    S: 0,
    requireCone: false
  });
  assert.equal(result.publicEvidenceOk, true);
  assert.equal(result.evidenceAuthorized, true);
  assert.equal(result.procurementReady, true);
});

test('observed local fallback requires explicit opt-in', () => {
  const accepted = evaluateProcurementReadiness({
    coreReady: true,
    evidenceConsole: { status: 'unreachable', authority: 'local' },
    env: { ACCEPT_LOCAL_EVIDENCE: '1' },
    config: {},
    S: 0,
    requireCone: false
  });
  const rejected = evaluateProcurementReadiness({
    coreReady: true,
    evidenceConsole: { status: 'unreachable', authority: 'local' },
    env: {},
    config: {},
    S: 0,
    requireCone: false
  });
  assert.equal(accepted.procurementReady, true);
  assert.equal(rejected.procurementReady, false);
});

test('local opt-in does not authorize a healthy status mislabeled local', () => {
  const result = evaluateProcurementReadiness({
    coreReady: true,
    evidenceConsole: { status: 'ok', authority: 'local' },
    env: { ACCEPT_LOCAL_EVIDENCE: '1' },
    config: {},
    S: 0,
    requireCone: false
  });
  assert.equal(result.evidenceAuthorized, false);
  assert.equal(result.procurementReady, false);
});

test('missing status is not treated as an observed local fallback', () => {
  const result = evaluateProcurementReadiness({
    coreReady: true,
    evidenceConsole: { authority: 'local' },
    env: { ACCEPT_LOCAL_EVIDENCE: '1' },
    config: {},
    S: 0,
    requireCone: false
  });
  assert.equal(result.evidenceAuthorized, false);
  assert.equal(result.procurementReady, false);
});

test('degraded response with non-local authority cannot use local opt-in', () => {
  const result = evaluateProcurementReadiness({
    coreReady: true,
    evidenceConsole: { status: 'unreachable', authority: 'public' },
    env: { ACCEPT_LOCAL_EVIDENCE: '1' },
    config: {},
    S: 0,
    requireCone: false
  });
  assert.equal(result.evidenceAuthorized, false);
  assert.equal(result.procurementReady, false);
});

test('force flag is observable metadata but cannot authorize or bypass core readiness', () => {
  const result = evaluateProcurementReadiness({
    coreReady: false,
    evidenceConsole: { status: 'unconfigured', authority: 'local' },
    env: { FORCE_PROCUREMENT: '1' },
    config: {},
    S: 0,
    requireCone: false
  });
  assert.equal(result.forceFlagSeen, true);
  assert.equal(result.forceAuthorizes, false);
  assert.equal(result.evidenceAuthorized, false);
  assert.equal(result.procurementReady, false);
});

test('cone violation keeps an otherwise opted-in local path on hold', () => {
  const result = evaluateProcurementReadiness({
    coreReady: true,
    evidenceConsole: { status: 'unreachable', authority: 'local' },
    env: { ACCEPT_LOCAL_EVIDENCE: '1' },
    config: {},
    S: -0.1,
    requireCone: true
  });
  assert.equal(result.coneCompliant, false);
  assert.equal(result.evidenceAuthorized, false);
  assert.equal(result.procurementReady, false);
});

test('production remains unauthorized without supply-chain evidence', () => {
  const result = evaluateProductionAuthorization({
    coreReady: true,
    supplyChainOk: false,
    env: {},
    config: {},
    S: 0,
    requireCone: false
  });
  assert.equal(result.productionAuthorized, false);
});

test('procurement readiness and production authorization are independent namespaces', () => {
  const result = evaluateGateNamespaces({
    coreReady: true,
    evidenceConsole: publicVerified,
    env: {},
    config: {},
    S: 0,
    supplyChainOk: false,
    requireCone: false
  });
  assert.equal(result.procurement.procurementReady, true);
  assert.equal(result.production.productionAuthorized, false);
  assert.equal(result.invariant.namespacesIndependent, true);
  assert.equal(result.invariant.forceNeverAuthorizes, true);
  assert.deepEqual(EVIDENCE_GATES, ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6']);
  assert.deepEqual(PRODUCTION_GATES, ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
});
