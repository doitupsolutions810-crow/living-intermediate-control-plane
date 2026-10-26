import { acceptsLocalEvidence } from './evidence-authorization.mjs';

/**
 * Evidence authorization is independent of operational readiness and force flags.
 * A healthy public console is valid evidence; local evidence requires explicit opt-in.
 */
export function evidenceAuthorizesProcurement({ evidenceConsole, env = process.env, config = {} } = {}) {
  const publicEvidenceValid =
    evidenceConsole?.status === 'ok' &&
    evidenceConsole?.authority === 'public';
  return publicEvidenceValid || acceptsLocalEvidence({ env, config });
}
