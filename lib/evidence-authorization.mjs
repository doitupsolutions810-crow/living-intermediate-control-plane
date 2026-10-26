/** Explicit authorization policy for local evidence fallback. */
export function acceptsLocalEvidence({ env = process.env, config = {} } = {}) {
  return (
    env.ACCEPT_LOCAL_EVIDENCE === '1' ||
    env.ACCEPT_LOCAL_EVIDENCE === 'true' ||
    config.acceptLocalEvidenceByDefault === true
  );
}

const LOCAL_FALLBACK_STATUSES = new Set([
  'not_found',
  'unreachable',
  'unconfigured',
  'invalid'
]);

/**
 * Authorize procurement only when core readiness and evidence authorization
 * independently hold. Public authorization requires a trusted status+schema
 * contract result from probeEvidenceConsole. Local authorization requires an
 * observed local fallback state AND explicit local-evidence opt-in.
 * Force/request flags are deliberately not inputs here.
 */
export function authorizeProcurement({
  coreReady = false,
  evidenceStatus = 'unknown',
  evidenceAuthority = 'unknown',
  trustContractVerified = false,
  localEvidenceAccepted = false
} = {}) {
  const coreIsReady = coreReady === true;
  const publicTrustContractVerified = trustContractVerified === true;
  const publicEvidenceVerified =
    evidenceStatus === 'ok' && evidenceAuthority === 'public' && publicTrustContractVerified;
  const localFallbackObserved =
    evidenceAuthority === 'local' &&
    LOCAL_FALLBACK_STATUSES.has(evidenceStatus);
  const localEvidenceExplicitlyAccepted =
    localFallbackObserved && localEvidenceAccepted === true;
  const evidenceAuthorized =
    publicEvidenceVerified || localEvidenceExplicitlyAccepted;
  const authorized = coreIsReady && evidenceAuthorized;

  let reason = 'evidence-not-authorized';
  if (!coreIsReady) {
    reason = 'core-not-ready';
  } else if (publicEvidenceVerified) {
    reason = 'public-evidence-contract-verified';
  } else if (localEvidenceExplicitlyAccepted) {
    reason = 'explicit-local-opt-in';
  } else if (evidenceAuthority === 'local' && !localFallbackObserved) {
    reason = 'local-fallback-state-unverified';
  }

  return {
    authorized,
    coreReady: coreIsReady,
    publicEvidenceVerified,
    publicTrustContractVerified,
    localFallbackObserved,
    localEvidenceExplicitlyAccepted,
    evidenceAuthorized,
    reason
  };
}
