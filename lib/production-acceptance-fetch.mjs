/**
 * Fetch a deployment-configured production acceptance artifact without treating
 * reachability as authority. Cryptographic and policy verification happens in
 * production-acceptance-attestation.mjs after this bounded transport step.
 */
const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_MAX_BYTES = 64 * 1024;
const HARD_MAX_BYTES = 256 * 1024;

export async function fetchProductionAcceptanceAttestation({
  url = process.env.PRODUCTION_ACCEPTANCE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  if (typeof url !== 'string' || !url.trim()) return null;

  let target;
  try {
    target = new URL(url);
  } catch {
    return null;
  }

  // The configured locator is a deployment trust input: require HTTPS, no URL
  // credentials, and no fragment. Refuse redirects so the fetched origin/path
  // cannot drift away from the configured endpoint.
  if (target.protocol !== 'https:' || target.username || target.password || target.hash) {
    return null;
  }
  if (typeof fetchImpl !== 'function') return null;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) return null;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > HARD_MAX_BYTES) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const rejectResponse = async (response) => {
    // Stop consuming an untrusted or oversized body after rejecting it.
    try { controller.abort(); } catch {}
    try { await response?.body?.cancel(); } catch {}
    return null;
  };

  try {
    const response = await fetchImpl(target.href, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'cache-control': 'no-cache',
      },
      signal: controller.signal,
    });

    if (!response || response.status !== 200 || response.ok !== true || response.redirected === true) return rejectResponse(response);
    // Native fetch exposes the final URL. If it is absent or differs, do not
    // accept an artifact whose source binding cannot be established.
    if (typeof response.url !== 'string' || response.url !== target.href) return rejectResponse(response);

    const contentType = (response.headers?.get('content-type') || '')
      .split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') return rejectResponse(response);

    const lengthHeader = response.headers?.get('content-length');
    if (lengthHeader !== null && lengthHeader !== undefined) {
      if (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > maxBytes) return rejectResponse(response);
    }

    if (!response.body || typeof response.body.getReader !== 'function') return rejectResponse(response);
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) return null;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          try { controller.abort(); } catch {}
          try { await reader.cancel(); } catch {}
          return null;
        }
        chunks.push(value);
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    // Timeout, network, decode, and parse errors all remain a hard hold.
    try { controller.abort(); } catch {}
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const PRODUCTION_ACCEPTANCE_FETCH_LIMITS = Object.freeze({
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxBytes: DEFAULT_MAX_BYTES,
  hardMaxBytes: HARD_MAX_BYTES,
});
