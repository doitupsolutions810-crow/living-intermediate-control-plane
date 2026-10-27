/**
 * Independent gate namespaces on the shared Great Scale residual.
 *
 * E0–E6  — evidence-console contract checks (procurement / public evidence)
 * G0–G6  — production readiness / acceptance gates
 *
 * Both namespaces may require cone compliance. Neither namespace authorizes the other.
 * Force flags are diagnostic only and never manufacture authority.
 *
 * Great Scale invariant:
 *   ProcurementReady ≠ ProductionAuthorized
 *   Authorized ⊃ ConeCompliant (when residual is evaluated)
 */
import { coneCompliant, residualSnapshot, CONE } from './great-scale-residual.mjs';
import { acceptsLocalEvidence, authorizeWithCone } from './evidence-authorization.mjs';

/** Evidence-console contract gate ids (procurement surface) */
export const EVIDENCE_GATES = Object.freeze(['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6']);

/** Production acceptance gate ids */
export const PRODUCTION_GATES = Object.freeze(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);

/**
 * Evaluate procurement readiness (E-namespace).
 * Does not claim production authorization.
 */
export function evaluateProcurementReadiness({
  coreReady = false,
  evidenceConsole = {},
  env = process.env,
  config = {},
  S = 0,
  requireCone = true,
} = {}) {
  const localOk = acceptsLocalEvidence({ env, config });
  const cone = authorizeWithCone({ S, env, config, requireCone });
  const publicOk =
    evidenceConsole.status === 'ok' &&
    evidenceConsole.authority === 'public';

  // Force is diagnostic metadata only — never an authorization input
  const forceFlag = env.FORCE_PROCUREMENT === '1' || env.FORCE_PROCUREMENT === 'true';

  const evidenceAuthorized =
    (publicOk || (localOk && ['not_found', 'unreachable', 'unconfigured', 'invalid', undefined].includes(evidenceConsole.status))) &&
    cone.coneCompliant;

  const procurementReady = coreReady && evidenceAuthorized;

  return {
    namespace: 'E',
    gates: EVIDENCE_GATES,
    procurementReady,
    evidenceAuthorized,
    publicEvidenceOk: publicOk,
    localEvidenceAccepted: localOk,
    coneCompliant: cone.coneCompliant,
    psi: cone.psi,
    cone: CONE,
    forceFlagSeen: forceFlag,
    forceAuthorizes: false,
    note: !coreReady
      ? 'Core readiness not met.'
      : !cone.coneCompliant
        ? 'Residual violates cone floor — procurement hold.'
        : publicOk
          ? 'Public evidence-console healthy; procurement ready.'
          : localOk
            ? 'Local evidence opted in; procurement ready under local authority.'
            : 'Public evidence required or set ACCEPT_LOCAL_EVIDENCE=1.',
  };
}

/**
 * Evaluate production authorization (G-namespace).
 * Independent of procurement readiness.
 */
export function evaluateProductionAuthorization({
  coreReady = false,
  supplyChainOk = false,
  measurementAttestationVerified = false,
  env = process.env,
  config = {},
  S = 0,
  requireCone = true,
} = {}) {
  const cone = authorizeWithCone({ S, env, config, requireCone });
  // A numeric residual is not a trusted measurement. Production requires an independently
  // verified, provenance-bound measurement attestation in addition to core + supply chain + cone.
  // This flag must only be set by a caller that has actually verified that attestation.
  const productionAuthorized = coreReady && supplyChainOk && measurementAttestationVerified && cone.coneCompliant;

  return {
    namespace: 'G',
    gates: PRODUCTION_GATES,
    productionAuthorized,
    coreReady,
    supplyChainOk,
    measurementAttestationVerified,
    coneCompliant: cone.coneCompliant,
    psi: cone.psi,
    cone: CONE,
    note: !coreReady
      ? 'Core readiness not met for production.'
      : !supplyChainOk
        ? 'Supply-chain evidence not authorized for production.'
        : !measurementAttestationVerified
          ? 'Trusted measurement attestation not independently verified — production hold.'
          : !cone.coneCompliant
          ? 'Residual violates cone floor — production hold.'
          : 'Production authorized under core + supply-chain + cone.',
  };
}

/**
 * Combined evaluation: both namespaces + residual snapshot.
 * Guarantees ProcurementReady is never treated as ProductionAuthorized.
 */
export function evaluateGateNamespaces(opts = {}) {
  const procurement = evaluateProcurementReadiness(opts);
  const production = evaluateProductionAuthorization(opts);
  const residual = residualSnapshot({
    S: opts.S ?? 0,
    tau: opts.tau ?? null,
    roleBlock: opts.roleBlock ?? 4,
  });

  return {
    schema: 'great-scale.gate-namespaces/v1',
    residual,
    procurement,
    production,
    invariant: {
      namespacesIndependent: true,
      forceNeverAuthorizes: true,
      coneRequired: opts.requireCone !== false,
      statement: 'ProcurementReady ≠ ProductionAuthorized; both respect cone when residual is evaluated.',
    },
  };
}
