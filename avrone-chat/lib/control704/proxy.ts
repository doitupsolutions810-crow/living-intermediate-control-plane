/**
 * Control704 proxy core — shared by /api/proxy/[target]/[...path] and the
 * proxy_x / proxy_y / proxy_z agent tools.
 *
 * Security properties:
 *  - Caller must already hold a verified session (role checked here again).
 *  - Upstream host is FIXED per target from env; the caller only supplies a
 *    path + query, which is validated and re-checked against the base origin
 *    (no SSRF / host override / open redirect).
 *  - Per-role method + path-prefix allowlists.
 *  - Upstream credentials injected server-side; caller auth headers/cookies
 *    are never forwarded and upstream Set-Cookie/Location are never returned.
 *  - Redirects are not followed (3xx → 502).
 *  - Request/response size limits, timeout, per-actor rate limit, audit.
 */

import { mintProxyToken, proxyJwtConfig } from './avrone-jwt';
import { appendAudit } from './audit';
import { rateLimit } from './ratelimit';
import type { Role } from './roles';
import { loadTarget, type TargetConfig, type TargetId } from './targets';

export const MAX_REQUEST_BYTES = 256 * 1024;
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const UPSTREAM_TIMEOUT_MS = 15_000;
export const MAX_QUERY_CHARS = 2048;

const FORWARD_REQ_HEADERS = ['accept', 'content-type', 'accept-language', 'if-none-match', 'if-modified-since'];
const RETURN_RES_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified', 'content-language'];
const SEGMENT_RE = /^[A-Za-z0-9._~!$&'()*+,;=:@-]{1,200}$/;

export interface ProxyActor {
  sub: string;
  role: Role;
}

export interface ProxyInput {
  target: TargetId;
  method: string;
  segments: string[];
  search?: string;
  headers?: Headers | Record<string, string>;
  body?: ArrayBuffer | Uint8Array | string | null;
  actor: ProxyActor;
  via?: 'http' | 'agent';
}

export interface ProxyResult {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
  error?: string;
}

function rateLimitPerMin(): number {
  const n = Number(process.env.CONTROL704_PROXY_RATE_PER_MIN || '');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
}

function jsonResult(status: number, error: string, extra?: Record<string, unknown>): ProxyResult {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: new TextEncoder().encode(JSON.stringify({ error, ...extra })),
    error
  };
}

/** Validate path segments and build a normalized path. Returns null when unsafe. */
export function buildSafePath(segments: string[]): string | null {
  if (!Array.isArray(segments) || segments.length > 32) return null;
  if (segments.length === 0) return '/';
  for (const s of segments) {
    if (typeof s !== 'string' || s === '.' || s === '..' || !SEGMENT_RE.test(s)) return null;
  }
  return '/' + segments.join('/');
}

export function pathAllowed(path: string, prefixes: string[]): boolean {
  return prefixes.some(p => p === '/' || path === p || path.startsWith(p + '/'));
}

/** Resolve the final upstream URL; null if it would escape the fixed base. */
export function resolveUpstream(t: TargetConfig, path: string, search = ''): URL | null {
  if (!t.base) return null;
  const basePath = t.base.pathname.replace(/\/+$/, '');
  const q = search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : '';
  if (q.length > MAX_QUERY_CHARS || /[\r\n\s#]/.test(q)) return null;
  let u: URL;
  try {
    u = new URL(`${t.base.origin}${basePath}${path === '/' ? '' : path}${q}`);
  } catch {
    return null;
  }
  if (u.origin !== t.base.origin) return null;
  if (basePath && !(u.pathname === basePath || u.pathname.startsWith(basePath + '/'))) return null;
  return u;
}

function pickHeaders(h: Headers | Record<string, string> | undefined, allow: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  const get = (k: string) =>
    h instanceof Headers ? h.get(k) : (Object.entries(h).find(([n]) => n.toLowerCase() === k)?.[1] ?? null);
  for (const k of allow) {
    const v = get(k);
    if (v && v.length < 1024 && !/[\r\n]/.test(v)) out[k] = v;
  }
  return out;
}

function toBytes(body: ProxyInput['body']): Uint8Array | null {
  if (body == null) return null;
  if (typeof body === 'string') return new TextEncoder().encode(body);
  return body instanceof Uint8Array ? body : new Uint8Array(body);
}

async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export async function proxyRequest(input: ProxyInput, fetchImpl: typeof fetch = fetch): Promise<ProxyResult> {
  const { actor } = input;
  const method = String(input.method || 'GET').toUpperCase();
  const t = loadTarget(input.target);
  const audit = (outcome: 'ok' | 'denied' | 'error', detail: Record<string, unknown>) =>
    appendAudit({
      actor: actor.sub,
      role: actor.role,
      action: `proxy.${t.id}`,
      target: `${method} ${detail.path ?? ''}`.trim(),
      outcome,
      detail: { via: input.via || 'http', ...detail }
    });

  if (!t.configured || !t.base) {
    return jsonResult(503, 'target_not_configured', { target: t.id, label: t.label });
  }

  const path = buildSafePath(input.segments);
  if (!path) {
    audit('denied', { reason: 'unsafe_path' });
    return jsonResult(400, 'unsafe_path');
  }

  const pol = t.policy[actor.role];
  if (!pol || !pol.methods.includes(method)) {
    audit('denied', { path, reason: 'method_not_allowed' });
    return jsonResult(403, 'method_not_allowed_for_role', { role: actor.role, method });
  }
  if (!pathAllowed(path, pol.paths)) {
    audit('denied', { path, reason: 'path_not_allowed' });
    return jsonResult(403, 'path_not_allowed_for_role', { role: actor.role });
  }

  const rl = rateLimit(`proxy:${actor.sub}:${t.id}`, rateLimitPerMin(), 60_000);
  if (!rl.ok) {
    return { ...jsonResult(429, 'rate_limited'), headers: { 'content-type': 'application/json', 'retry-after': String(rl.retryAfterS) } };
  }

  const bodyBytes = method === 'GET' || method === 'HEAD' ? null : toBytes(input.body);
  if (bodyBytes && bodyBytes.byteLength > MAX_REQUEST_BYTES) {
    audit('denied', { path, reason: 'request_too_large', bytes: bodyBytes.byteLength });
    return jsonResult(413, 'request_too_large', { maxBytes: MAX_REQUEST_BYTES });
  }

  const url = resolveUpstream(t, path, input.search);
  if (!url) {
    audit('denied', { path, reason: 'upstream_escape' });
    return jsonResult(400, 'invalid_upstream_path');
  }

  const headers: Record<string, string> = {
    ...pickHeaders(input.headers, FORWARD_REQ_HEADERS),
    'x-control704-actor': actor.sub,
    'x-control704-role': actor.role,
    'user-agent': 'avrone-control704-proxy/1'
  };
  if (t.tokenMode === 'avrone-jwt') {
    // Per-technician identity for control704-proxy-system: a short-lived JWT for this actor
    // replaces the shared static credential. Fail closed when the contract is not configured.
    const cfg = proxyJwtConfig();
    if (!cfg) {
      audit('denied', { path, reason: 'proxy_jwt_not_configured' });
      return jsonResult(503, 'proxy_jwt_not_configured', { target: t.id });
    }
    try {
      const { token } = await mintProxyToken(actor.sub, actor.role, { config: cfg });
      headers.authorization = `Bearer ${token}`;
    } catch (err) {
      audit('denied', { path, reason: 'proxy_jwt_mint_failed', err: err instanceof Error ? err.message : 'error' });
      return jsonResult(503, 'proxy_jwt_not_configured', { target: t.id });
    }
  } else if (t.token) {
    headers[t.authHeader] = t.authHeader === 'authorization' ? `Bearer ${t.token}` : t.token;
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      method,
      headers,
      body: (bodyBytes ?? undefined) as BodyInit | undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  } catch (err) {
    const msg = err instanceof Error ? err.name : 'fetch_failed';
    audit('error', { path, reason: 'upstream_unreachable', err: msg });
    return jsonResult(502, 'upstream_unreachable');
  }

  if (res.status >= 300 && res.status < 400) {
    audit('denied', { path, reason: 'redirect_blocked', status: res.status });
    return jsonResult(502, 'upstream_redirect_blocked', { status: res.status });
  }

  const body = method === 'HEAD' ? new Uint8Array(0) : await readCapped(res, MAX_RESPONSE_BYTES);
  if (!body) {
    audit('error', { path, reason: 'response_too_large' });
    return jsonResult(502, 'upstream_response_too_large', { maxBytes: MAX_RESPONSE_BYTES });
  }

  audit(res.ok ? 'ok' : 'error', { path, status: res.status, bytes: body.byteLength, ms: Date.now() - started });
  return {
    status: res.status,
    headers: { ...pickHeaders(res.headers, RETURN_RES_HEADERS), 'x-control704-target': t.id },
    body
  };
}
