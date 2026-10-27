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
import { verifyProductionAcceptanceAttestation } from './production-acceptance-attestation.mjs';

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
  productionAcceptanceAttestation = null,
  env = process.env,
  config = {},
  S = 0,
  requireCone = true,
} = {}) {
  const localOk = acceptsLocalEvidence({ env, config });
  // A public label is not proof by itself: require the probe's explicit
  // independently verified status/schema contract result.
  // The producer's E0-E6 document attests its own contract, not production
  // acceptance evidence. Procurement requires a separate, independently verified
  // acceptance artifact; contract verification alone must never authorize procurement.
  const publicContractOk =
    evidenceConsole.status === 'ok' &&
    evidenceConsole.authority === 'public' &&
    evidenceConsole.trustContractVerified === true;
  // Only a cryptographically verified, separately signed G0-G6 attestation can
  // satisfy production acceptance. Caller-supplied booleans are intentionally ignored.
  // Verification config must come from trusted deployment configuration.
  const acceptanceVerification = verifyProductionAcceptanceAttestation(
    productionAcceptanceAttestation,
    { environment: 'production' },
  );
  const procurementEvidenceOk = acceptanceVerification.valid === true;
  // Use only the signed measurement carried by a valid attestation. Missing or
  // invalid evidence produces NaN, which fails the cone comparison closed.
  const effectiveS = procurementEvidenceOk ? acceptanceVerification.residual.S : Number.NaN;
  const cone = authorizeWithCone({ S: effectiveS, env, config, requireCone });
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
    acceptanceVerification,
    localEvidenceAccepted: localOk,
    coneCompliant: cone.coneCompliant,
    psi: cone.psi,
    cone: CONE,
    forceFlagSeen: forceFlag,
    forceAuthorizes: false,
    note: !coreReady
      ? 'Core readiness not met.'
      : evidenceConsole.status === 'invalid'
        ? 'Evidence trust verification failed; procurement hold; local fallback is prohibited.'
        : !procurementEvidenceOk
        ? 'Production-acceptance evidence is absent or invalid; signed residual provenance is unverified; procurement hold.'
        : !cone.coneCompliant
          ? 'Residual violates cone floor — procurement hold.'
          : publicOk
            ? 'Public production-acceptance evidence and residual measurement verified; procurement ready.'
            : publicContractOk
              ? 'Source contract verified, but required procurement evidence is not authorized; procurement hold.'
              : localFallbackOk
                ? 'Recognized availability failure with separately verified production-acceptance evidence; procurement ready.'
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
  productionAcceptanceAttestation = null,
  env = process.env,
  config = {},
  S = 0,
  requireCone = true,
} = {}) {
  // supplyChainOk is retained as diagnostic input only. A caller-supplied boolean
  // cannot prove G0-G6; production authorization requires the same independently
  // pinned, build-bound, signed acceptance artifact that procurement verifies.
  const acceptanceVerification = verifyProductionAcceptanceAttestation(
    productionAcceptanceAttestation,
    { environment: 'production' },
  );
  const productionAcceptanceVerified = acceptanceVerification.valid === true;
  // Production must evaluate the exact signed residual measurement, never the
  // caller's default S=0 or an environment value with no provenance.
  const effectiveS = productionAcceptanceVerified ? acceptanceVerification.residual.S : Number.NaN;
  const cone = authorizeWithCone({ S: effectiveS, env, config, requireCone });
  const productionAuthorized =
    coreReady && productionAcceptanceVerified && cone.coneCompliant;

  return {
    namespace: 'G',
    gates: PRODUCTION_GATES,
    productionAuthorized,
    productionAcceptanceVerified,
    acceptanceVerification,
    coreReady,
    supplyChainOk,
    coneCompliant: cone.coneCompliant,
    psi: cone.psi,
    cone: CONE,
    note: !coreReady
      ? 'Core readiness not met for production.'
      : !productionAcceptanceVerified
        ? 'Signed production-acceptance evidence is missing or invalid; production hold.'
        : !cone.coneCompliant
          ? 'Residual violates cone floor — production hold.'
          : 'Signed G0-G6 production acceptance verified; production authorization conditions satisfied.',
  };
}

/**
 * Combined evaluation: both namespaces + residual snapshot.
 * Guarantees ProcurementReady is never treated as ProductionAuthorized.
 */
export function evaluateGateNamespaces(opts = {}) {
  const procurement = evaluateProcurementReadiness(opts);
  const production = evaluateProductionAuthorization(opts);
  const verifiedResidual = production.acceptanceVerification.valid === true
    ? production.acceptanceVerification.residual
    : null;
  const residual = verifiedResidual
    ? {
        ...residualSnapshot({
          S: verifiedResidual.S,
          roleBlock: opts.roleBlock ?? 4,
        }),
        observed: true,
        sourceId: verifiedResidual.sourceId,
        buildId: verifiedResidual.buildId,
        measuredAt: verifiedResidual.measuredAt,
        provenanceVerified: true,
      }
    : {
        schema: 'great-scale.residual/v1',
        observed: false,
        S: null,
        psi: null,
        coneOk: false,
        provenanceVerified: false,
        note: 'No valid signed, fresh, build-bound residual measurement; default S=0 is not evidence.',
      };

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
