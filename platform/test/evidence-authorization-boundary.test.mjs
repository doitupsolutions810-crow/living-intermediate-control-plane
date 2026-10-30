import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateProcurementReadiness,
  evaluateProductionAuthorization,
} from "../../lib/gate-namespaces.mjs";

const SAFE_RESIDUAL = 0.05;
const NO_OPT_IN = Object.freeze({});
const CORE_READY = true;

const fallbackStates = [
  "not_found",
  "unreachable",
  "unconfigured",
  "invalid",
  undefined,
];

for (const status of fallbackStates) {
  test(`local fallback status ${String(status)} does not authorize without explicit opt-in`, () => {
    const result = evaluateProcurementReadiness({
      coreReady: CORE_READY,
      evidenceConsole: { status, authority: "local" },
      env: NO_OPT_IN,
      config: {},
      S: SAFE_RESIDUAL,
      requireCone: true,
    });

    assert.equal(result.publicEvidenceOk, false);
    assert.equal(result.localEvidenceAccepted, false);
    assert.equal(result.evidenceAuthorized, false);
    assert.equal(result.procurementReady, false);
  });
}

test("public evidence is authorized independently of local fallback opt-in", () => {
  const result = evaluateProcurementReadiness({
    coreReady: CORE_READY,
    evidenceConsole: { status: "ok", authority: "public" },
    env: NO_OPT_IN,
    config: {},
    S: SAFE_RESIDUAL,
    requireCone: true,
  });

  assert.equal(result.publicEvidenceOk, true);
  assert.equal(result.localEvidenceAccepted, false);
  assert.equal(result.evidenceAuthorized, true);
  assert.equal(result.procurementReady, true);
});

test("explicit local opt-in authorizes only the procurement evidence path", () => {
  const result = evaluateProcurementReadiness({
    coreReady: CORE_READY,
    evidenceConsole: { status: "unreachable", authority: "local" },
    env: { ACCEPT_LOCAL_EVIDENCE: "1" },
    config: {},
    S: SAFE_RESIDUAL,
    requireCone: true,
  });

  assert.equal(result.localEvidenceAccepted, true);
  assert.equal(result.evidenceAuthorized, true);
  assert.equal(result.procurementReady, true);
});

test("FORCE_PROCUREMENT is diagnostic only and cannot authorize local fallback", () => {
  const result = evaluateProcurementReadiness({
    coreReady: CORE_READY,
    evidenceConsole: { status: "unreachable", authority: "local" },
    env: { FORCE_PROCUREMENT: "1" },
    config: {},
    S: SAFE_RESIDUAL,
    requireCone: true,
  });

  assert.equal(result.forceFlagSeen, true);
  assert.equal(result.forceAuthorizes, false);
  assert.equal(result.evidenceAuthorized, false);
  assert.equal(result.procurementReady, false);
});

test("procurement readiness is not production authorization", () => {
  const production = evaluateProductionAuthorization({
    coreReady: CORE_READY,
    supplyChainOk: false,
    env: { ACCEPT_LOCAL_EVIDENCE: "1" },
    config: {},
    S: SAFE_RESIDUAL,
    requireCone: true,
  });

  assert.equal(production.supplyChainOk, false);
  assert.equal(production.productionAuthorized, false);
});

test("cone violation blocks public evidence even when public console is healthy", () => {
  const result = evaluateProcurementReadiness({
    coreReady: CORE_READY,
    evidenceConsole: { status: "ok", authority: "public" },
    env: NO_OPT_IN,
    config: {},
    S: -1,
    requireCone: true,
  });

  assert.equal(result.publicEvidenceOk, true);
  assert.equal(result.coneCompliant, false);
  assert.equal(result.evidenceAuthorized, false);
  assert.equal(result.procurementReady, false);
});
