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
  // A public label is not proof by itself: require the probe's explicit
  // independently verified status/schema contract result.
  // The producer's E0-E6 document attests its own contract, not production
  // acceptance evidence. Procurement requires a separate, independently verified
  // acceptance artifact; contract verification alone must never authorize procurement.
  const publicContractOk =
    evidenceConsole.status === 'ok' &&
    evidenceConsole.authority === 'public' &&
    evidenceConsole.trustContractVerified === true;
  // RELEASE HOLD: no authoritative production-acceptance artifact verifier is
  // implemented and wired into this gate yet. Never trust a caller-supplied boolean
  // such as procurementEvidenceVerified; it is metadata, not cryptographic proof.
  // Availability fallback cannot manufacture or replace acceptance evidence.
  const procurementEvidenceOk = false;
  const publicOk = publicContractOk && procurementEvidenceOk;

  // Force is diagnostic metadata only — never an authorization input
  const forceFlag = env.FORCE_PROCUREMENT === '1' || env.FORCE_PROCUREMENT === 'true';

  // Local fallback is authorized only for an observed, recognized degraded
  // state. Missing/unknown status is not evidence of a failure mode.
  const localFallbackObserved =
    evidenceConsole.authority === 'local' &&
    ['not_found', 'unreachable', 'unconfigured'].includes(evidenceConsole.status);
  const localFallbackOk = localOk && localFallbackObserved && procurementEvidenceOk;
  const evidenceAuthorized =
    (publicOk || localFallbackOk) &&
    cone.coneCompliant;

  const procurementReady = coreReady && evidenceAuthorized;

  return {
    namespace: 'E',
    gates: EVIDENCE_GATES,
    procurementReady,
    evidenceAuthorized,
    publicEvidenceOk: publicOk,
    publicContractOk,
    procurementEvidenceOk,
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
          ? 'Public production-acceptance evidence verified; procurement ready.'
          : publicContractOk
            ? 'Source contract verified, but production-acceptance evidence is absent; procurement hold.'
          : localOk && localFallbackObserved && !procurementEvidenceOk
            ? 'Recognized availability failure, but production-acceptance evidence is absent; procurement hold.'
            : localFallbackOk
            ? 'Recognized availability failure with separately verified production-acceptance evidence; procurement ready.'
            : evidenceConsole.status === 'invalid'
              ? 'Evidence trust verification failed; procurement hold; local fallback is prohibited.'
              : localOk
                ? 'Local evidence opt-in is set, but no eligible degraded state was observed; procurement hold.'
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
  env = process.env,
  config = {},
  S = 0,
  requireCone = true,
} = {}) {
  const cone = authorizeWithCone({ S, env, config, requireCone });
  // Production requires core + supply-chain evidence + cone; local opt-in alone is insufficient
  const productionAuthorized = coreReady && supplyChainOk && cone.coneCompliant;

  return {
    namespace: 'G',
    gates: PRODUCTION_GATES,
    productionAuthorized,
    coreReady,
    supplyChainOk,
    coneCompliant: cone.coneCompliant,
    psi: cone.psi,
    cone: CONE,
    note: !coreReady
      ? 'Core readiness not met for production.'
      : !supplyChainOk
        ? 'Supply-chain evidence not authorized for production.'
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
