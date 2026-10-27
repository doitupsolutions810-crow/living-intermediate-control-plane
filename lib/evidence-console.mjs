import { verifySignedEvidenceSource } from './evidence-source-signature.mjs';
/**
 * Evidence-console probe. HTTP reachability is diagnostic, not authority.
 * Public authorization requires the v5.4.0 status and JSON-schema contract.
 */

const DEFAULT_TIMEOUT_MS = 5000;
const EVIDENCE_CONTRACT = Object.freeze({
  version: '5.4.0',
  runtime: 'static',
  privacy: 'local-only',
  serverSideEvidenceStorage: false,
  syntheticEvidenceRejected: true,
  productionEvidenceClassRequired: true,
  requiredEvidenceClass: 'production-acceptance',
  requiredEnvironment: 'production',
  mandatoryGates: 7
});
const STATUS_FIELDS = Object.keys(EVIDENCE_CONTRACT);
const EXPECTED_GATE_IDS = Object.freeze(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
const STATUS_SCHEMA_URI = 'https://json-schema.org/draft/2020-12/schema';
const MAX_EVIDENCE_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 30 * 1000;
const SOURCE_TIMESTAMP_PATTERN = /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:[.][0-9]{1,3})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/;

function parseSourceTimestamp(value) {
  if (typeof value !== 'string' || !SOURCE_TIMESTAMP_PATTERN.test(value)) return NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return NaN;
  // Date.parse normalizes impossible dates on some inputs; reject calendar rollover.
  const datePart = value.slice(0, 10);
  const calendarDate = Date.parse(`${datePart}T00:00:00Z`);
  if (!Number.isFinite(calendarDate) || new Date(calendarDate).toISOString().slice(0, 10) !== datePart) {
    return NaN;
  }
  return parsed;
}

export function evidenceConsoleUrlFromEnv(env = process.env) {
  const raw = (env.EVIDENCE_CONSOLE_URL || env.PUBLIC_EVIDENCE_CONSOLE_URL || '').trim();
  return raw ? raw.replace(/\/+$/, '') : '';
}

function endpointUrls(configuredUrl) {
  const parsed = new URL(configuredUrl);
  if (parsed.protocol !== 'https:') {
    throw new TypeError('Public evidence-console endpoints must use HTTPS.');
  }
  let prefix = parsed.pathname.replace(/\/+$/, '');
  for (const suffix of ['/api/status', '/api/v1/evidence/schema']) {
    if (prefix.endsWith(suffix)) {
      prefix = prefix.slice(0, -suffix.length).replace(/\/+$/, '');
      break;
    }
  }
  const base = parsed.origin + (prefix && prefix !== '/' ? prefix : '');
  return {
    statusUrl: `${base}/api/status`,
    schemaUrl: `${base}/api/v1/evidence/schema`
  };
}

function propertyAllows(property, expected) {
  if (!property || typeof property !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(property, 'const')) {
    return property.const === expected;
  }
  if (Array.isArray(property.enum)) return property.enum.includes(expected);
  return false;
}

function readGateStatuses(statusDocument) {
  const field = ['gates', 'gateStatuses', 'results']
    .find(key => Object.prototype.hasOwnProperty.call(statusDocument, key));
  if (!field) return { field: null, entries: null, shape: null };

  const value = statusDocument[field];
  if (Array.isArray(value)) {
    return {
      field,
      shape: 'array',
      entries: value.map(item => ({
        id: item && typeof item === 'object' ? item.id : undefined,
        status: item && typeof item === 'object' ? item.status : undefined
      }))
    };
  }
  if (value && typeof value === 'object') {
    return {
      field,
      shape: 'object',
      entries: Object.entries(value).map(([id, item]) => ({
        id,
        status: typeof item === 'string' ? item : item && typeof item === 'object' ? item.status : undefined
      }))
    };
  }
  return { field, entries: null, shape: null };
}

function validGateEntries(gateData) {
  if (!Array.isArray(gateData.entries) ||
      gateData.entries.length !== EVIDENCE_CONTRACT.mandatoryGates) return false;
  const ids = gateData.entries.map(entry => entry.id);
  return ids.every(id => EXPECTED_GATE_IDS.includes(id)) &&
    new Set(ids).size === EXPECTED_GATE_IDS.length &&
    EXPECTED_GATE_IDS.every(id => ids.includes(id)) &&
    gateData.entries.every(entry => entry.status === 'READY');
}

function schemaRequiresExactGateCoverage(gateSchema) {
  const allOf = gateSchema?.allOf;
  if (!Array.isArray(allOf) || allOf.length !== EXPECTED_GATE_IDS.length) return false;
  return EXPECTED_GATE_IDS.every(gateId => allOf.some(rule => {
    const containsSchema = rule?.contains;
    const required = Array.isArray(containsSchema?.required) ? containsSchema.required : [];
    return containsSchema?.properties?.id?.const === gateId &&
      required.includes('id') &&
      rule.minContains === 1 &&
      rule.maxContains === 1;
  }));
}

/**
 * Validate the status payload and the schema independently. Never merge their
 * properties before validation: one endpoint cannot fill gaps in the other.
 */
export function validateEvidenceConsoleContract(statusDocument, schemaDocument, {
  now = Date.now(),
  maxEvidenceAgeMs = MAX_EVIDENCE_AGE_MS,
  maxClockSkewMs = MAX_CLOCK_SKEW_MS
} = {}) {
  const failures = [];
  if (!statusDocument || typeof statusDocument !== 'object' || Array.isArray(statusDocument)) {
    return { valid: false, failures: ['status_document_not_object'] };
  }
  if (!schemaDocument || typeof schemaDocument !== 'object' || Array.isArray(schemaDocument)) {
    return { valid: false, failures: ['schema_document_not_object'] };
  }

  for (const [key, expected] of Object.entries(EVIDENCE_CONTRACT)) {
    if (statusDocument[key] !== expected) {
      failures.push(`status_${key}_mismatch`);
    }
  }

  // The client probe time is not source freshness. Only source-issued timestamps
  // can establish that this status document was generated recently and has not expired.
  const sourceGeneratedAt = parseSourceTimestamp(statusDocument.sourceGeneratedAt);
  const sourceExpiresAt = parseSourceTimestamp(statusDocument.sourceExpiresAt);
  if (!Number.isFinite(sourceGeneratedAt) || !Number.isFinite(sourceExpiresAt)) {
    failures.push('status_source_freshness_timestamps_invalid');
  } else {
    if (sourceGeneratedAt > now + maxClockSkewMs) {
      failures.push('status_source_generated_at_in_future');
    }
    if (now - sourceGeneratedAt > maxEvidenceAgeMs) {
      failures.push('status_source_evidence_stale');
    }
    if (sourceExpiresAt <= now) {
      failures.push('status_source_evidence_expired');
    }
    if (sourceExpiresAt <= sourceGeneratedAt ||
        sourceExpiresAt - sourceGeneratedAt > maxEvidenceAgeMs) {
      failures.push('status_source_evidence_lifetime_invalid');
    }
  }

  if (statusDocument.overall !== 'READY') failures.push('status_overall_not_ready');

  const gateData = readGateStatuses(statusDocument);
  if (!gateData.field || !validGateEntries(gateData)) {
    failures.push('status_gates_not_all_ready_or_incomplete');
  }

  if (schemaDocument.$schema !== STATUS_SCHEMA_URI) failures.push('schema_draft_mismatch');
  if (schemaDocument.type !== 'object') failures.push('schema_root_type_mismatch');
  const properties = schemaDocument.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    failures.push('schema_properties_missing');
  } else {
    for (const [key, expected] of Object.entries(EVIDENCE_CONTRACT)) {
      if (!propertyAllows(properties[key], expected)) {
        failures.push(`schema_${key}_constraint_mismatch`);
      }
    }
    for (const key of ['sourceGeneratedAt', 'sourceExpiresAt']) {
      const rule = properties[key];
      if (!rule || rule.type !== 'string' || rule.format !== 'date-time') {
        failures.push(`schema_${key}_constraint_mismatch`);
      }
    }
    if (!propertyAllows(properties.overall, 'READY')) {
      failures.push('schema_overall_constraint_mismatch');
    }
    if (!gateData.field || !properties[gateData.field]) {
      failures.push('schema_gate_field_missing');
    } else {
      const gateSchema = properties[gateData.field];
      const gateItemSchema = gateSchema.items;
      const itemProperties = gateItemSchema?.properties;
      const itemRequired = Array.isArray(gateItemSchema?.required) ? gateItemSchema.required : [];
      const idEnum = itemProperties?.id?.enum;
      const exactIdEnum = Array.isArray(idEnum) &&
        idEnum.length === EXPECTED_GATE_IDS.length &&
        EXPECTED_GATE_IDS.every(id => idEnum.includes(id));
      const exactArraySize = gateSchema.type === 'array' &&
        gateSchema.minItems === EVIDENCE_CONTRACT.mandatoryGates &&
        gateSchema.maxItems === EVIDENCE_CONTRACT.mandatoryGates &&
        gateSchema.uniqueItems === true &&
        gateItemSchema?.type === 'object' &&
        itemRequired.includes('id') && itemRequired.includes('status') &&
        exactIdEnum &&
        propertyAllows(itemProperties?.status, 'READY') &&
        schemaRequiresExactGateCoverage(gateSchema);
      const gateProperties = gateSchema.properties;
      const gateRequired = Array.isArray(gateSchema.required) ? gateSchema.required : [];
      const exactObjectShape = gateSchema.type === 'object' &&
        gateSchema.additionalProperties === false &&
        gateProperties && Object.keys(gateProperties).length === EVIDENCE_CONTRACT.mandatoryGates &&
        gateRequired.length === EXPECTED_GATE_IDS.length &&
        EXPECTED_GATE_IDS.every(id => gateRequired.includes(id) &&
          gateProperties[id] && (
            propertyAllows(gateProperties[id], 'READY') ||
            (propertyAllows(gateProperties[id].properties?.status, 'READY') &&
             Array.isArray(gateProperties[id].required) &&
             gateProperties[id].required.includes('status'))
          ));
      if (!exactArraySize && !exactObjectShape) failures.push('schema_gate_shape_mismatch');
    }
  }

  const required = schemaDocument.required;
  if (!Array.isArray(required)) {
    failures.push('schema_required_fields_missing');
  } else {
    const expectedRequired = [...STATUS_FIELDS, 'sourceGeneratedAt', 'sourceExpiresAt', 'overall'];
    if (gateData.field) expectedRequired.push(gateData.field);
    for (const key of expectedRequired) {
      if (!required.includes(key)) failures.push(`schema_required_${key}_missing`);
    }
  }

  return { valid: failures.length === 0, failures };
}

function fallbackAuthority(acceptLocal) {
  return acceptLocal ? 'local' : 'public';
}

function resultBase({ status, httpStatus = null, authority, url = null, schemaUrl = null,
  note, checkedAt, trustContractVerified = false, trustFailures = [] }) {
  return { status, httpStatus, authority, url, schemaUrl, note, checkedAt,
    trustContractVerified, trustFailures };
}

async function fetchJson(url, { fetchImpl, timeoutMs }) {
  const requestedUrl = new URL(url);
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache'
    }
  });

  // Defense in depth: public trust must stay bound to the exact HTTPS endpoint.
  // Native Fetch populates response.url; simple test doubles may leave it empty.
  const finalUrl = response.url ? new URL(response.url) : requestedUrl;
  if (
    finalUrl.protocol !== 'https:' ||
    finalUrl.origin !== requestedUrl.origin ||
    finalUrl.pathname !== requestedUrl.pathname ||
    finalUrl.search !== requestedUrl.search
  ) {
    throw new Error('Evidence endpoint response escaped its requested HTTPS URL.');
  }

  let document = null;
  if (response.ok) {
    try {
      document = await response.json();
    } catch {
      // A successful HTTP status with a non-JSON body is not trusted evidence.
    }
  }
  return { response, document };
}

/**
 * Probe the evidence-console and verify both the status payload and schema.
 * Optional fetchImpl enables deterministic tests without network I/O.
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
    return resultBase({
      status: 'unconfigured', authority: fallbackAuthority(acceptLocal),
      note: 'EVIDENCE_CONSOLE_URL unset; public trust is unverified.',
      checkedAt
    });
  }

  if (typeof fetchImpl !== 'function') {
    return resultBase({
      status: 'unreachable', authority: fallbackAuthority(acceptLocal), url,
      note: 'fetch unavailable; public trust is unverified.', checkedAt
    });
  }

  let endpoints;
  try {
    endpoints = endpointUrls(url);
  } catch (err) {
    return resultBase({
      status: 'invalid', authority: fallbackAuthority(acceptLocal), url,
      note: `Evidence-console URL invalid: ${err instanceof Error ? err.message : String(err)}`,
      checkedAt, trustFailures: ['url_invalid']
    });
  }

  let statusResponse;
  try {
    statusResponse = await fetchJson(endpoints.statusUrl, { fetchImpl, timeoutMs });
  } catch (err) {
    return resultBase({
      status: 'unreachable', authority: fallbackAuthority(acceptLocal), url: endpoints.statusUrl,
      schemaUrl: endpoints.schemaUrl,
      note: `Evidence-console status endpoint unreachable: ${err instanceof Error ? err.message : String(err)}`,
      checkedAt, trustFailures: ['status_endpoint_unreachable']
    });
  }

  if (statusResponse.response.status === 404) {
    return resultBase({
      status: 'not_found', httpStatus: 404, authority: fallbackAuthority(acceptLocal),
      url: endpoints.statusUrl, schemaUrl: endpoints.schemaUrl,
      note: 'Evidence-console status endpoint returned 404; public trust is unverified.',
      checkedAt, trustFailures: ['status_endpoint_not_found']
    });
  }
  if (!statusResponse.response.ok || !statusResponse.document) {
    return resultBase({
      status: 'invalid', httpStatus: statusResponse.response.status,
      authority: fallbackAuthority(acceptLocal), url: endpoints.statusUrl,
      schemaUrl: endpoints.schemaUrl,
      note: 'Evidence-console status endpoint did not return a valid JSON document.',
      checkedAt, trustFailures: ['status_http_or_json_invalid']
    });
  }

  let schemaResponse;
  try {
    schemaResponse = await fetchJson(endpoints.schemaUrl, { fetchImpl, timeoutMs });
  } catch (err) {
    return resultBase({
      status: 'invalid', httpStatus: null, authority: fallbackAuthority(acceptLocal),
      url: endpoints.statusUrl, schemaUrl: endpoints.schemaUrl,
      note: `Evidence-console schema endpoint unreachable: ${err instanceof Error ? err.message : String(err)}`,
      checkedAt, trustFailures: ['schema_endpoint_unreachable']
    });
  }

  if (!schemaResponse.response.ok || !schemaResponse.document) {
    return resultBase({
      status: 'invalid', httpStatus: schemaResponse.response.status,
      authority: fallbackAuthority(acceptLocal), url: endpoints.statusUrl,
      schemaUrl: endpoints.schemaUrl,
      note: 'Evidence-console schema endpoint unavailable or not valid JSON.',
      checkedAt, trustFailures: ['schema_http_or_json_invalid']
    });
  }

  const contract = validateEvidenceConsoleContract(statusResponse.document, schemaResponse.document);
  if (!contract.valid) {
    return resultBase({
      status: 'invalid', httpStatus: statusResponse.response.status,
      authority: fallbackAuthority(acceptLocal), url: endpoints.statusUrl,
      schemaUrl: endpoints.schemaUrl,
      note: 'Evidence-console responded, but its status/schema trust contract did not verify.',
      checkedAt, trustFailures: contract.failures
    });
  }

  const sourceTrust = verifySignedEvidenceSource(statusResponse.document, schemaResponse.document);
  if (!sourceTrust.valid) {
    return resultBase({
      status: 'invalid', httpStatus: statusResponse.response.status,
      authority: fallbackAuthority(acceptLocal), url: endpoints.statusUrl,
      schemaUrl: endpoints.schemaUrl,
      note: 'Evidence-console source signature or independently pinned trust anchor did not verify.',
      checkedAt, trustFailures: sourceTrust.failures
    });
  }

  return resultBase({
    status: 'ok', httpStatus: statusResponse.response.status, authority: 'public',
    url: endpoints.statusUrl, schemaUrl: endpoints.schemaUrl,
    note: 'Evidence-console status and schema trust contract verified.',
    checkedAt, trustContractVerified: true
  });
}
