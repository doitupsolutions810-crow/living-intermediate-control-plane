/**
 * Graceful public evidence-console probe.
 * When the public domain 404s or is unreachable, local plane status remains temporary authority.
 * No secrets — URL from env/config only.
 */

/**
 * @typedef {{
 *   status: 'ok' | 'not_found' | 'unreachable' | 'unconfigured' | 'invalid',
 *   httpStatus: number | null,
 *   authority: 'public' | 'local',
 *   url: string | null,
 *   note: string,
 *   checkedAt: string
 * }} EvidenceConsoleResult
 */

const DEFAULT_TIMEOUT_MS = 5000;

export function evidenceConsoleUrlFromEnv(env = process.env) {
  const raw = (env.EVIDENCE_CONSOLE_URL || env.PUBLIC_EVIDENCE_CONSOLE_URL || '').trim();
  return raw ? raw.replace(/\/$/, '') : '';
}

/**
 * Probe the public evidence-console. Never throws — always returns a structured result.
 * Optional `fetchImpl` lets self-tests inject a stub without network I/O.
 */
export async function probeEvidenceConsole(options = {}) {
  const {
    url = evidenceConsoleUrlFromEnv(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    acceptLocal = true
  } = options;

  const checkedAt = new Date().toISOString();

  if (!url) {
    return {
      status: 'unconfigured',
      httpStatus: null,
      authority: acceptLocal ? 'local' : 'public',
      url: null,
      note: 'EVIDENCE_CONSOLE_URL unset — using local plane status as temporary evidence authority.',
      checkedAt
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      status: 'unreachable',
      httpStatus: null,
      authority: acceptLocal ? 'local' : 'public',
      url,
      note: 'fetch unavailable — treating evidence-console as unreachable; local authority accepted.',
      checkedAt
    };
  }

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json, text/html;q=0.8, */*;q=0.5' }
    });

    if (res.status === 404) {
      return {
        status: 'not_found',
        httpStatus: 404,
        authority: acceptLocal ? 'local' : 'public',
        url,
        note: 'Public evidence-console returned 404 — graceful fallback to local plane authority.',
        checkedAt
      };
    }

    if (!res.ok) {
      return {
        status: 'invalid',
        httpStatus: res.status,
        authority: acceptLocal ? 'local' : 'public',
        url,
        note: `Public evidence-console returned HTTP ${res.status} — local authority accepted until the domain is healthy.`,
        checkedAt
      };
    }

    return {
      status: 'ok',
      httpStatus: res.status,
      authority: 'public',
      url,
      note: 'Public evidence-console reachable.',
      checkedAt
    };
  } catch (err) {
    return {
      status: 'unreachable',
      httpStatus: null,
      authority: acceptLocal ? 'local' : 'public',
      url,
      note: `Evidence-console unreachable (${err instanceof Error ? err.message : String(err)}) — local authority accepted.`,
      checkedAt
    };
  }
}
