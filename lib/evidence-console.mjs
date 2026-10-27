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

function endpointIdentityFailure(response, expectedUrl) {
  if (!response || typeof response !== 'object') {
    return { code: 'RESPONSE_INVALID', detail: 'endpoint returned no response object' };
  }
  if ((Number.isInteger(response.status) && response.status >= 300 && response.status < 400) ||
      response.redirected === true || response.type === 'opaqueredirect') {
    return { code: 'REDIRECT_REJECTED', detail: 'endpoint redirects are not permitted for evidence trust' };
  }
  if (typeof response.url !== 'string' || response.url !== expectedUrl) {
    return { code: 'FINAL_URL_MISMATCH', detail: 'response URL does not match the exact configured endpoint' };
  }
  return null;
}

function isJsonResponse(response) {
  return (response.headers?.get('content-type') || '')
    .split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

function invalidTrustResult({ url, httpStatus = null, schemaUrl = null, code, detail, checkedAt }) {
  return {
    status: 'invalid',
    httpStatus,
    authority: 'public',
    trustContractVerified: false,
    verificationFailures: [{ code, detail }],
    url,
    ...(schemaUrl ? { schemaUrl } : {}),
    note: 'Evidence endpoint identity or transport contract failed; public and local fallback authority denied.',
    checkedAt
  };
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

  let target;
  try {
    target = new URL(url);
  } catch {
    return invalidTrustResult({
      url, code: 'ENDPOINT_URL_INVALID',
      detail: 'evidence-console URL must be an absolute configured HTTPS URL',
      checkedAt
    });
  }
  if (target.protocol !== 'https:' || target.username || target.password ||
      target.search || target.hash) {
    return invalidTrustResult({
      url, code: 'ENDPOINT_URL_POLICY',
      detail: 'evidence-console endpoint must use HTTPS without credentials, query, or fragment',
      checkedAt
    });
  }
  const statusUrl = target.href;

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
    const res = await fetchImpl(statusUrl, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json', 'cache-control': 'no-cache' }
    });

    const statusIdentityFailure = endpointIdentityFailure(res, statusUrl);
    if (statusIdentityFailure) {
      return invalidTrustResult({
        url: statusUrl, httpStatus: res?.status ?? null,
        code: statusIdentityFailure.code, detail: statusIdentityFailure.detail, checkedAt
      });
    }

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
      return invalidTrustResult({
        url: statusUrl, httpStatus: res.status, code: 'STATUS_HTTP',
        detail: `status endpoint returned HTTP ${res.status}`, checkedAt
      });
    }
    if (!isJsonResponse(res)) {
      return invalidTrustResult({
        url: statusUrl, httpStatus: res.status, code: 'STATUS_CONTENT_TYPE',
        detail: 'status endpoint must return application/json', checkedAt
      });
    }

    // Producer publishes status and its exact schema at separate endpoints.
    // HTTP 2xx proves reachability only; both documents must bind and verify.
    let document;
    let schema;
    let verification;
    try {
      const schemaUrl = new URL('/api/v1/evidence/schema', statusUrl).toString();
      const schemaResponse = await fetchImpl(schemaUrl, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json', 'cache-control': 'no-cache' }
      });
      const schemaIdentityFailure = endpointIdentityFailure(schemaResponse, schemaUrl);
      if (schemaIdentityFailure) {
        return invalidTrustResult({
          url: statusUrl, schemaUrl, httpStatus: res.status,
          code: schemaIdentityFailure.code, detail: schemaIdentityFailure.detail, checkedAt
        });
      }
      if (!schemaResponse.ok) {
        return invalidTrustResult({
          url: statusUrl, schemaUrl, httpStatus: res.status,
          code: 'SCHEMA_HTTP', detail: `schema endpoint returned HTTP ${schemaResponse.status}`, checkedAt
        });
      }
      if (!isJsonResponse(schemaResponse)) {
        return invalidTrustResult({
          url: statusUrl, schemaUrl, httpStatus: res.status,
          code: 'SCHEMA_CONTENT_TYPE', detail: 'schema endpoint must return application/json', checkedAt
        });
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
