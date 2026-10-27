/** Explicit authorization policy for local evidence fallback + Great Scale cone check. */

import { coneCompliant, psi, CONE } from './great-scale-residual.mjs';

/**
 * Local evidence is accepted only when explicitly opted in.
 * Force flags or diagnostic metadata must never authorize.
 */
export function acceptsLocalEvidence({ env = process.env, config = {} } = {}) {
  return (
    env.ACCEPT_LOCAL_EVIDENCE === '1' ||
    env.ACCEPT_LOCAL_EVIDENCE === 'true' ||
    config.acceptLocalEvidenceByDefault === true
  );
}

/**
 * Authorization is the operational dual of the cone floor.
 * A residual that would drive Ψ below CONE is rejected.
 * Procurement readiness and production authorization remain independent namespaces;
 * both are required to respect the cone when a residual is present.
 */
export function authorizeWithCone({
  S = 0,
  env = process.env,
  config = {},
  requireCone = true,
} = {}) {
  const localOk = acceptsLocalEvidence({ env, config });
  const coneOk = !requireCone || coneCompliant(S);
  return {
    authorized: localOk && coneOk,
    localEvidenceAccepted: localOk,
    coneCompliant: coneOk,
    psi: psi(S),
    cone: CONE,
    note: !localOk
      ? 'Local evidence not opted in — fail closed.'
      : !coneOk
        ? 'Residual violates cone floor — fail closed.'
        : 'Authorized under explicit local opt-in and cone compliance.',
  };
}
