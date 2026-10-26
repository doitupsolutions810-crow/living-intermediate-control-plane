/**
 * Evidence-console probe. HTTP reachability is diagnostic, not authority.
 * Public authorization requires the v5.3.1 status and JSON-schema contract.
 */

const DEFAULT_TIMEOUT_MS = 5000;
const EVIDENCE_CONTRACT = Object.freeze({
  version: '5.3.1',
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
const STATUS_SCHEMA_URI = 'https://json-schema.org/draft/2020-12/schema';

export function evidenceConsoleUrlFromEnv(env = process.env) {
  const raw = (env.EVIDENCE_CONSOLE_URL || env.PUBLIC_EVIDENCE_CONSOLE_URL || '').trim();
  return raw ? raw.replace(/\/+$/, '') : '';
}

function endpointUrls(configuredUrl) {
  const parsed = new URL(configuredUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TypeError('Evidence-console URL must use HTTP or HTTPS.');
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
  if (!field) return { field: null, statuses: null };

  const value = statusDocument[field];
  if (Array.isArray(value)) {
    return {
      field,
      statuses: value.map(item =>
        typeof item === 'string' ? item : item && typeof item === 'object' ? item.status : undefined
      )
    };
  }
  if (value && typeof value === 'object') {
    return { field, statuses: Object.values(value).map(item =>
      typeof item === 'string' ? item : item && typeof item === 'object' ? item.status : undefined
    ) };
  }
  return { field, statuses: null };
}

/**
 * Validate the status payload and the schema independently. Never merge their
 * properties before validation: one endpoint cannot fill gaps in the other.
 */
export function validateEvidenceConsoleContract(statusDocument, schemaDocument) {
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
  if (statusDocument.overall !== 'READY') failures.push('status_overall_not_ready');

  const gateData = readGateStatuses(statusDocument);
  if (!gateData.field || !Array.isArray(gateData.statuses) ||
      gateData.statuses.length !== EVIDENCE_CONTRACT.mandatoryGates ||
      gateData.statuses.some(status => status !== 'READY')) {
    failures.push('status_gates_not_all_ready');
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
    if (!propertyAllows(properties.overall, 'READY')) {
      failures.push('schema_overall_constraint_mismatch');
    }
    if (!gateData.field || !properties[gateData.field]) {
      failures.push('schema_gate_field_missing');
    } else {
      const gateSchema = properties[gateData.field];
      const gateItemSchema = gateSchema.items;
      const arrayItemsRequireReady = propertyAllows(gateItemSchema, 'READY') ||
        propertyAllows(gateItemSchema?.properties?.status, 'READY');
      const exactArraySize = gateSchema.type === 'array' &&
        gateSchema.minItems === EVIDENCE_CONTRACT.mandatoryGates &&
        gateSchema.maxItems === EVIDENCE_CONTRACT.mandatoryGates &&
        arrayItemsRequireReady;
      const gateProperties = gateSchema.properties;
      const gateIds = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
      const exactObjectShape = gateSchema.type === 'object' &&
        gateProperties && Object.keys(gateProperties).length === EVIDENCE_CONTRACT.mandatoryGates &&
        gateIds.every(id =>
          gateProperties[id] && propertyAllows(gateProperties[id].properties?.status || gateProperties[id], 'READY')
        );
      if (!exactArraySize && !exactObjectShape) failures.push('schema_gate_shape_mismatch');
    }
  }

  const required = schemaDocument.required;
  if (!Array.isArray(required)) {
    failures.push('schema_required_fields_missing');
  } else {
    const expectedRequired = [...STATUS_FIELDS, 'overall'];
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
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json' }
  });
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

  return resultBase({
    status: 'ok', httpStatus: statusResponse.response.status, authority: 'public',
    url: endpoints.statusUrl, schemaUrl: endpoints.schemaUrl,
    note: 'Evidence-console status and schema trust contract verified.',
    checkedAt, trustContractVerified: true
  });
}
