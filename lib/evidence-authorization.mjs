/** Explicit authorization policy for public and local evidence. */
export function acceptsLocalEvidence({ env = process.env, config = {} } = {}) {
  return (
    env.ACCEPT_LOCAL_EVIDENCE === '1' ||
    env.ACCEPT_LOCAL_EVIDENCE === 'true' ||
    config.acceptLocalEvidenceByDefault === true
  );
}

/**
 * Public evidence is authorized only after a successful public probe.
 * Local evidence requires explicit operator opt-in. Force flags are deliberately
 * not accepted here: they may not grant evidence authority.
 */
export function isEvidenceAuthorized({
  evidenceConsole,
  env = process.env,
  config = {}
} = {}) {
  if (
    evidenceConsole?.status === 'ok' &&
    evidenceConsole?.authority === 'public'
  ) {
    return true;
  }

  return (
    evidenceConsole?.authority === 'local' &&
    acceptsLocalEvidence({ env, config })
  );
}
