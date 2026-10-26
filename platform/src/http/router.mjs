import { isIP } from 'node:net';

/**
 * Permit tokenless operation only on loopback. A non-loopback listener must
 * have an explicit bearer token configured; otherwise auth checks would be
 * silently disabled by requireAuth's local-development behavior.
 */
export function assertSecureBinding(host, token) {
  const normalized = String(host || '').toLowerCase();
  const ipv4Loopback = isIP(normalized) === 4
    && Number(normalized.split('.')[0]) === 127;
  // Keep hostname allowance narrow. Do not use a string prefix for IPv4:
  // "127.example.com" is a hostname, not proof of a loopback address.
  const loopback = normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]'
    || ipv4Loopback;
  if (!loopback && !String(token || '')) {
    throw new Error('CONTROL12_PLATFORM_TOKEN is required when binding to a non-loopback host');
  }
}

export function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  });
  res.end(data);
}

export function sendOptions(res) {
  res.writeHead(204, {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  });
  res.end();
}

export async function readJson(req, maxBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw Object.assign(new Error('body too large'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid json'), { statusCode: 400 });
  }
}

export function requireAuth(req, token) {
  if (!token) return;
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1] !== token) {
    throw Object.assign(new Error('unauthorized'), { statusCode: 401 });
  }
}

export function requireAuthUnlessChatOpen(req, token, chatOpen) {
  if (chatOpen) return;
  requireAuth(req, token);
}
