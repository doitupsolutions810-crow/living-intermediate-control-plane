/** Explicit authorization policy for local evidence fallback. */
export function acceptsLocalEvidence({ env = process.env, config = {} } = {}) {
  return (
    env.ACCEPT_LOCAL_EVIDENCE === '1' ||
    env.ACCEPT_LOCAL_EVIDENCE === 'true' ||
    config.acceptLocalEvidenceByDefault === true
  );
}
