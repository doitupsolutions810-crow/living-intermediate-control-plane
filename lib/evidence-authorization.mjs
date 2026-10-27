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
export function isEvidenceAuthorized({ status, authority, localOptIn = false } = {}) {
  const publicEvidenceValid = status === 'ok' && authority === 'public';
  const explicitlyAcceptedLocalEvidence = authority === 'local' && localOptIn === true;
  return publicEvidenceValid || explicitlyAcceptedLocalEvidence;
}
