/**
 * Graceful public evidence-console probe.
 * When the public domain 404s or is unreachable, local plane status remains temporary authority.
 * No secrets — URL from env/config only.
 */

const DEFAULT_TIMEOUT_MS = 5000;

function result(status, httpStatus, source, url, note, checkedAt) {
  return {
    status,
    httpStatus,
    source,
    evidenceDisposition: source === 'public'
      ? 'reachable_unverified'
      : source === 'local'
        ? 'local_fallback_unverified'
        : 'unavailable',
    evidenceVerified: false,
    url,
    note,
    checkedAt
  };
}

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
    return result(
      'unconfigured', null, acceptLocal ? 'local' : 'none', null,
      acceptLocal
        ? 'EVIDENCE_CONSOLE_URL unset — local status is operational fallback only; no claim evidence is verified.'
        : 'EVIDENCE_CONSOLE_URL unset — no evidence source is available.',
      checkedAt
    );
  }

  if (typeof fetchImpl !== 'function') {
    return result(
      'unreachable', null, acceptLocal ? 'local' : 'none', url,
      acceptLocal
        ? 'fetch unavailable — local status is operational fallback only; no claim evidence is verified.'
        : 'fetch unavailable — no evidence source is available.',
      checkedAt
    );
  }

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json, text/html;q=0.8, */*;q=0.5' }
    });

    if (res.status === 404) {
      return result(
        'not_found', 404, acceptLocal ? 'local' : 'none', url,
        acceptLocal
          ? 'Public evidence-console returned 404 — local status is operational fallback only; no claim evidence is verified.'
          : 'Public evidence-console returned 404 — no evidence source is available.',
        checkedAt
      );
    }

    if (!res.ok) {
      return result(
        'invalid', res.status, acceptLocal ? 'local' : 'none', url,
        acceptLocal
          ? `Public evidence-console returned HTTP ${res.status} — local status is operational fallback only; no claim evidence is verified.`
          : `Public evidence-console returned HTTP ${res.status} — no evidence source is available.`,
        checkedAt
      );
    }

    return result(
      'ok', res.status, 'public', url,
      'Public endpoint reachable; evidence contents, provenance, and scientific claims have not been validated.',
      checkedAt
    );
  } catch (err) {
    return result(
      'unreachable', null, acceptLocal ? 'local' : 'none', url,
      acceptLocal
        ? `Evidence-console unreachable (${err instanceof Error ? err.message : String(err)}) — local status is operational fallback only; no claim evidence is verified.`
        : `Evidence-console unreachable (${err instanceof Error ? err.message : String(err)}) — no evidence source is available.`,
      checkedAt
    );
  }
}
