const MAX_RESPONSE_BYTES = 64 * 1024;
const SCALE_SCHEMA = 'great-scale.descent/v0.4.2';
const SCALE_SOURCE_VERSION = 'great-scale/public/scale.js@a0fd4b10b964932f90abf7004bbe7e28687168d1';
const SNAPSHOT_KEYS = [
  'schema', 'sourceVersion', 'running', 't', 'x', 'k', 'nearFixed', 'residual',
  'residualNormalized', 'historyLen', 'last', 'universe_id', 'cycle_count',
  'stress_residual_normalized'
];
const LAST_KEYS = ['t', 'x', 'S', 'residual', 'residualNormalized', 'nearFixed', 'involution'];

function bridgeError(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

function parseEndpoint(value) {
  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    throw bridgeError(503, 'SCALE_BRIDGE_INVALID_URL', 'CycleKernal scale URL is invalid');
  }

  const hostname = endpoint.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const loopback = hostname === 'localhost' || hostname === '::1' || /^127\./.test(hostname);
  if (!['https:', 'http:'].includes(endpoint.protocol) ||
      (endpoint.protocol === 'http:' && !loopback) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      endpoint.pathname.replace(/\/+$/, '') !== '/api/v1/scale/state') {
    throw bridgeError(503, 'SCALE_BRIDGE_INVALID_URL', 'CycleKernal scale URL must be a secure state endpoint');
  }
  return endpoint;
}

function validSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const hasExactKeys = (candidate, expected) => {
    const keys = Object.keys(candidate);
    return keys.length === expected.length && expected.every((key) => Object.hasOwn(candidate, key));
  };
  if (!hasExactKeys(value, SNAPSHOT_KEYS)) return false;
  const finite = (item) => typeof item === 'number' && Number.isFinite(item);
  const integer = (item) => Number.isSafeInteger(item) && item >= 0;
  const lastMatchesSnapshot = value.last === null
    ? value.t === 0 && value.historyLen === 0
    : value.last && typeof value.last === 'object' && !Array.isArray(value.last) &&
      hasExactKeys(value.last, LAST_KEYS) &&
      integer(value.last.t) && value.last.t === value.t &&
      finite(value.last.x) && Math.abs(value.last.x - value.x) <= 1e-8 &&
      finite(value.last.S) && Math.abs(value.last.S - (value.last.x / 9) * (1 - value.last.x / 9)) <= 1e-8 &&
      finite(value.last.residual) && Math.abs(value.last.residual - value.residual) <= 1e-8 &&
      finite(value.last.residualNormalized) && Math.abs(value.last.residualNormalized - value.residualNormalized) <= 1e-8 &&
      value.last.nearFixed === value.nearFixed &&
      finite(value.last.involution) &&
      Math.abs(value.last.involution - ((9 - ((value.last.x % 9) + 9) % 9) % 9)) <= 1e-8;
  return value.schema === SCALE_SCHEMA &&
    value.sourceVersion === SCALE_SOURCE_VERSION &&
    typeof value.running === 'boolean' && integer(value.t) &&
    finite(value.x) && value.x >= 1 && value.x <= 8 &&
    finite(value.k) && Math.abs(value.k) < 1 &&
    value.nearFixed === (Math.abs(value.x - 4.5) < 0.05) &&
    finite(value.residual) && value.residual >= 0 && value.residual <= 7 &&
    finite(value.residualNormalized) && value.residualNormalized >= 0 && value.residualNormalized <= 1 &&
    integer(value.historyLen) && value.historyLen <= value.t &&
    value.universe_id === 'U1' &&
    integer(value.cycle_count) && value.t === value.cycle_count && lastMatchesSnapshot &&
    finite(value.stress_residual_normalized) &&
    Math.abs(value.residual - Math.abs(2 * value.x - 9)) <= 1e-8 &&
    Math.abs(value.stress_residual_normalized - value.residualNormalized) <= 1e-8 &&
    Math.abs(value.residualNormalized - value.residual / 7) <= 1e-8;
}

async function discardBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    return;
  }
}

async function readBoundedBody(response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    await discardBody(response);
    throw bridgeError(502, 'CYCLEKERNEL_INVALID_RESPONSE', 'CycleKernal scale response is too large');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
      throw bridgeError(502, 'CYCLEKERNEL_INVALID_RESPONSE', 'CycleKernal scale response is too large');
    }
    return body;
  }

  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw bridgeError(502, 'CYCLEKERNEL_INVALID_RESPONSE', 'CycleKernal scale response is too large');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error.code === 'CYCLEKERNEL_INVALID_RESPONSE') throw error;
    throw bridgeError(502, 'CYCLEKERNEL_INVALID_RESPONSE', 'CycleKernal scale response could not be read');
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export function createCycleKernelScaleClient({ endpoint = '', token = '', fetchImpl = fetch, timeoutMs = 3000 } = {}) {
  return async function getCycleKernelScaleState() {
    if (!endpoint || !token) {
      throw bridgeError(503, 'SCALE_BRIDGE_NOT_CONFIGURED', 'CycleKernal scale bridge requires URL and token');
    }

    const url = parseEndpoint(endpoint);
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json', authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch {
      throw bridgeError(502, 'CYCLEKERNEL_UNAVAILABLE', 'CycleKernal scale service is unavailable');
    }

    if (!response.ok) {
      await discardBody(response);
      throw bridgeError(502, 'CYCLEKERNEL_UNAVAILABLE', 'CycleKernal scale service returned an error');
    }
    const contentType = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      await discardBody(response);
      throw bridgeError(502, 'CYCLEKERNEL_INVALID_RESPONSE', 'CycleKernal scale response is not JSON');
    }
    const body = await readBoundedBody(response);

    let snapshot;
    try {
      snapshot = JSON.parse(body);
    } catch {
      throw bridgeError(502, 'CYCLEKERNEL_INVALID_RESPONSE', 'CycleKernal scale response is not valid JSON');
    }
    if (!validSnapshot(snapshot)) {
      throw bridgeError(502, 'CYCLEKERNEL_INVALID_RESPONSE', 'CycleKernal scale response failed schema validation');
    }
    return snapshot;
  };
}
