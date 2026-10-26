/** Explicit authorization policy for local evidence fallback. */
export function acceptsLocalEvidence({ env = process.env, config = {} } = {}) {
  return (
    env.ACCEPT_LOCAL_EVIDENCE === '1' ||
    env.ACCEPT_LOCAL_EVIDENCE === 'true' ||
    config.acceptLocalEvidenceByDefault === true
  );
}

/**
 * Authorize procurement only when core readiness and evidence authorization
 * independently hold. Force/request flags are deliberately not inputs here.
 */
export function authorizeProcurement({
  coreReady = false,
  evidenceStatus = 'unknown',
  evidenceAuthority = 'unknown',
  localEvidenceAccepted = false
} = {}) {
  const coreIsReady = coreReady === true;
  const publicEvidenceVerified =
    evidenceStatus === 'ok' && evidenceAuthority === 'public';
  const localEvidenceExplicitlyAccepted = localEvidenceAccepted === true;
  const evidenceAuthorized =
    publicEvidenceVerified || localEvidenceExplicitlyAccepted;
  const authorized = coreIsReady && evidenceAuthorized;

  let reason = 'evidence-not-authorized';
  if (!coreIsReady) {
    reason = 'core-not-ready';
  } else if (publicEvidenceVerified) {
    reason = 'public-evidence-verified';
  } else if (localEvidenceExplicitlyAccepted) {
    reason = 'explicit-local-opt-in';
  }

  return {
    authorized,
    coreReady: coreIsReady,
    publicEvidenceVerified,
    localEvidenceExplicitlyAccepted,
    evidenceAuthorized,
    reason
  };
}
