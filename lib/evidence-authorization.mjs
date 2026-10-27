/** Explicit authorization policy for evidence used by procurement. */
export function acceptsLocalEvidence({ env = process.env, config = {} } = {}) {
  return (
    env.ACCEPT_LOCAL_EVIDENCE === '1' ||
    env.ACCEPT_LOCAL_EVIDENCE === 'true' ||
    config.acceptLocalEvidenceByDefault === true
  );
}

/**
 * Public evidence authorizes only when its probe succeeded as public.
 * Local fallback authorizes only with explicit local-evidence opt-in.
 * Operator force flags are deliberately not accepted by this policy.
 */
export function isEvidenceAuthorized({ status, authority, localOptIn = false, trustContractVerified = false } = {}) {
  const publicEvidenceValid =
    status === 'ok' && authority === 'public' && trustContractVerified === true;
  const explicitlyAcceptedLocalEvidence = authority === 'local' && localOptIn === true;
  return publicEvidenceValid || explicitlyAcceptedLocalEvidence;
}

const LOCAL_FALLBACK_STATUSES = new Set([
  'not_found',
  'unreachable',
  'unconfigured',
  'invalid'
]);

/**
 * Full procurement authorization. Public evidence must include the independently
 * validated status/schema contract. Local fallback requires an observed
 * degraded state and explicit local opt-in. Force flags are not inputs.
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
  const publicEvidenceContractVerified =
    evidenceStatus === 'ok' &&
    evidenceAuthority === 'public' &&
    publicTrustContractVerified;
  const localFallbackObserved =
    evidenceAuthority === 'local' &&
    LOCAL_FALLBACK_STATUSES.has(evidenceStatus);
  const localEvidenceExplicitlyAccepted =
    localFallbackObserved && localEvidenceAccepted === true;
  const evidenceAuthorized =
    publicEvidenceContractVerified || localEvidenceExplicitlyAccepted;
  const authorized = coreIsReady && evidenceAuthorized;

  let reason = 'evidence-not-authorized';
  if (!coreIsReady) reason = 'core-not-ready';
  else if (publicEvidenceContractVerified) reason = 'public-evidence-contract-verified';
  else if (localEvidenceExplicitlyAccepted) reason = 'explicit-local-opt-in';
  else if (evidenceAuthority === 'local' && !localFallbackObserved) reason = 'local-fallback-state-unverified';

  return {
    authorized,
    coreReady: coreIsReady,
    publicEvidenceContractVerified,
    publicTrustContractVerified,
    localFallbackObserved,
    localEvidenceExplicitlyAccepted,
    evidenceAuthorized,
    reason
  };
}
