/**
 * Graceful public evidence-console probe.
 * When the public domain 404s or is unreachable, local plane status remains temporary authority.
 * No secrets — URL from env/config only.
 */

import { verifyProducerEvidenceContract } from './producer-evidence-contract.mjs';

const DEFAULT_TIMEOUT_MS = 5000;

export function evidenceConsoleUrlFromEnv(env = process.env) {
  const raw = (env.EVIDENCE_CONSOLE_URL || env.PUBLIC_EVIDENCE_CONSOLE_URL || '').trim();
  return raw ? raw.replace(/\/$/, '') : '';
}

/**
 * Probe the public evidence-console. Never throws — always returns a structured result.
 * Optional `fetchImpl` lets self-tests inject a stub without network I/O.
 *
 * @returns {{ status: string, httpStatus: number|null, authority: string, url: string|null, note: string, checkedAt: string }}
 */
export async function probeEvidenceConsole(options = {}) {
  const {
    url = evidenceConsoleUrlFromEnv(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    acceptLocal = true,
    verifyDocument = verifyProducerEvidenceContract,
    verifyOptions = {}
  } = options;

  const checkedAt = new Date().toISOString();

  if (!url) {
    return {
      status: 'unconfigured',
      httpStatus: null,
      authority: acceptLocal ? 'local' : 'public',
      url: null,
      note: acceptLocal
        ? 'EVIDENCE_CONSOLE_URL unset — local evidence is available only under explicit local authorization.'
        : 'EVIDENCE_CONSOLE_URL unset — no public source configured and local authority is disabled.',
      checkedAt
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      status: 'unreachable',
      httpStatus: null,
      authority: acceptLocal ? 'local' : 'public',
      url,
      note: acceptLocal
        ? 'fetch unavailable — source treated as unreachable; local fallback is eligible subject to the procurement gate.'
        : 'fetch unavailable — source treated as unreachable; local fallback is disabled.',
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
        note: acceptLocal
          ? 'Public evidence-console returned 404 — local fallback is eligible subject to the procurement gate.'
          : 'Public evidence-console returned 404 — local fallback is disabled.',
        checkedAt
      };
    }

    if (!res.ok) {
      return {
        status: 'invalid',
        httpStatus: res.status,
        // A reachable server error is not proof of an outage-safe local fallback.
        // Reserve local fallback for explicit not-found/unreachable/unconfigured states.
        authority: 'public',
        url,
        note: `Public evidence-console returned HTTP ${res.status} — trust is unverified; local fallback is not eligible for this invalid state.`,
        checkedAt
      };
    }

    // Producer publishes status and its exact schema at separate endpoints.
    // HTTP 2xx proves reachability only; both documents must bind and verify.
    let document;
    let schema;
    let verification;
    try {
      const schemaUrl = new URL('/api/v1/evidence/schema', url).toString();
      const schemaResponse = await fetchImpl(schemaUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' }
      });
      if (!schemaResponse.ok) {
        return {
          status: 'invalid',
          httpStatus: res.status,
          schemaHttpStatus: schemaResponse.status,
          // The endpoint answered but could not supply its contract; do not downgrade trust.
          authority: 'public',
          trustContractVerified: false,
          verificationFailures: [{ code: 'SCHEMA_HTTP', detail: 'source schema endpoint did not return 2xx' }],
          url,
          note: 'Public status reachable but its schema endpoint is unavailable; public authority denied.',
          checkedAt
        };
      }
      document = await res.json();
      schema = await schemaResponse.json();
      verification = await verifyDocument(document, schema, verifyOptions);
    } catch (err) {
      verification = {
        valid: false,
        failures: [{ code: 'DOCUMENT_OR_SCHEMA', detail: err instanceof Error ? err.message : String(err) }]
      };
    }

    if (!verification || verification.valid !== true) {
      return {
        status: 'invalid',
        httpStatus: res.status,
        // Failed verification is a trust failure, not an availability fallback.
        authority: 'public',
        trustContractVerified: false,
        verificationFailures: verification?.failures ?? [{ code: 'VERIFIER', detail: 'verification did not return valid=true' }],
        url,
        note: 'Trust failure: public endpoint reachable but its evidence contract did not verify; public and local fallback authority denied.',
        checkedAt
      };
    }

    return {
      status: 'ok',
      httpStatus: res.status,
      authority: 'public',
      trustContractVerified: true,
      verificationFailures: [],
      url,
      note: 'Public endpoint and signed evidence contract verified.',
      checkedAt
    };
  } catch (err) {
    return {
      status: 'unreachable',
      httpStatus: null,
      authority: acceptLocal ? 'local' : 'public',
      url,
      note: acceptLocal
        ? `Evidence-console unreachable (${err instanceof Error ? err.message : String(err)}) — local fallback is eligible subject to the procurement gate.`
        : `Evidence-console unreachable (${err instanceof Error ? err.message : String(err)}) — local fallback is disabled.`,
      checkedAt
    };
  }
}
