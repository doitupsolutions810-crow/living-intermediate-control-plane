/**
 * Control704 proxy targets X, Y, Z.
 *
 * Names and auth modes come from the existing control704-proxy-system repo
 * (src/proxy.js):  X → token-override,  Y → dataset-code,  Z → lattice-op.
 * That repo never defined upstream hosts, so every upstream is env-driven and
 * a target with no URL reports "not configured" (fail closed).
 *
 * Per target T in {X,Y,Z}:
 *   CONTROL704_PROXY_T_URL      fixed https base URL (required to enable)
 *   CONTROL704_PROXY_T_TOKEN    upstream credential, injected server-side only
 *   CONTROL704_PROXY_T_AUTH_HEADER  header for the token (default: authorization → "Bearer <token>")
 *   CONTROL704_PROXY_T_TOKEN_MODE   "static" (default: send CONTROL704_PROXY_T_TOKEN) or
 *        "avrone-jwt": mint a short-lived per-technician HS256 JWT (lib/control704/avrone-jwt.ts)
 *        that control704-proxy-system verifies; needs AVRONE_ISSUER/AUDIENCE/JWT_SECRET.
 *   CONTROL704_PROXY_T_LABEL    display name (rename X/Y/Z without code changes)
 *   CONTROL704_PROXY_T_PATHS    comma list of allowed path prefixes (default "/")
 *   CONTROL704_PROXY_T_POLICY   optional JSON per-role policy:
 *        {"viewer":{"methods":["GET"],"paths":["/status"]},"technician":{...},"admin":{...}}
 */

import { ROLES, type Role } from './roles';

export const TARGET_IDS = ['x', 'y', 'z'] as const;
export type TargetId = (typeof TARGET_IDS)[number];

export function isTargetId(v: unknown): v is TargetId {
  return typeof v === 'string' && (TARGET_IDS as readonly string[]).includes(v);
}

export interface RolePolicy {
  methods: string[];
  paths: string[];
}

export interface TargetConfig {
  id: TargetId;
  label: string;
  authMode: 'token-override' | 'dataset-code' | 'lattice-op';
  configured: boolean;
  /** Parsed base URL when configured. Never includes credentials. */
  base: URL | null;
  configError?: string;
  token: string | null;
  authHeader: string;
  /** static: inject `token`; avrone-jwt: mint a per-technician Control704 JWT per request. */
  tokenMode: 'static' | 'avrone-jwt';
  policy: Record<Role, RolePolicy>;
}

const DEFAULTS: Record<TargetId, { label: string; authMode: TargetConfig['authMode'] }> = {
  x: { label: 'X · token-override', authMode: 'token-override' },
  y: { label: 'Y · dataset-code', authMode: 'dataset-code' },
  z: { label: 'Z · lattice-op', authMode: 'lattice-op' }
};

const DEFAULT_METHODS: Record<Role, string[]> = {
  viewer: ['GET', 'HEAD'],
  technician: ['GET', 'HEAD', 'POST'],
  admin: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']
};

const METHOD_SET = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
const HEADER_RE = /^[a-z0-9-]{1,64}$/;

function env(name: string, e: NodeJS.ProcessEnv): string {
  return (e[name] || '').trim();
}

function normPrefix(p: string): string | null {
  const s = p.trim();
  if (!s.startsWith('/') || s.includes('..') || s.includes('\\') || s.includes('//')) return null;
  return s.length > 1 ? s.replace(/\/+$/, '') : '/';
}

function parsePaths(raw: unknown, fallback: string[]): string[] {
  const list = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === 'string'
      ? raw.split(',')
      : null;
  if (!list) return fallback;
  const out = list.map(normPrefix).filter((x): x is string => Boolean(x));
  return out.length ? out : fallback;
}

function parseMethods(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  return raw.map(m => String(m).toUpperCase()).filter(m => METHOD_SET.has(m));
}

export function parseBaseUrl(raw: string, e: NodeJS.ProcessEnv = process.env): { url: URL | null; error?: string } {
  if (!raw) return { url: null };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { url: null, error: 'invalid URL' };
  }
  const allowHttp = env('CONTROL704_PROXY_ALLOW_HTTP', e) === '1';
  if (u.protocol !== 'https:' && !(allowHttp && u.protocol === 'http:')) {
    return { url: null, error: 'upstream must be https' };
  }
  if (u.username || u.password) return { url: null, error: 'credentials in URL not allowed' };
  u.search = '';
  u.hash = '';
  return { url: u };
}

export function loadTarget(id: TargetId, e: NodeJS.ProcessEnv = process.env): TargetConfig {
  const T = id.toUpperCase();
  const def = DEFAULTS[id];
  const { url, error } = parseBaseUrl(env(`CONTROL704_PROXY_${T}_URL`, e), e);
  const basePaths = parsePaths(env(`CONTROL704_PROXY_${T}_PATHS`, e) || undefined, ['/']);

  let custom: Record<string, { methods?: unknown; paths?: unknown }> = {};
  const rawPolicy = env(`CONTROL704_PROXY_${T}_POLICY`, e);
  if (rawPolicy) {
    try {
      const p = JSON.parse(rawPolicy);
      if (p && typeof p === 'object') custom = p;
    } catch {
      /* ignore bad policy → defaults */
    }
  }
  const policy = {} as Record<Role, RolePolicy>;
  for (const r of ROLES) {
    policy[r] = {
      methods: parseMethods(custom[r]?.methods, DEFAULT_METHODS[r]),
      paths: parsePaths(custom[r]?.paths, basePaths)
    };
  }

  const hdr = env(`CONTROL704_PROXY_${T}_AUTH_HEADER`, e).toLowerCase() || 'authorization';
  return {
    id,
    label: env(`CONTROL704_PROXY_${T}_LABEL`, e).slice(0, 60) || def.label,
    authMode: def.authMode,
    configured: Boolean(url),
    base: url,
    configError: error,
    token: env(`CONTROL704_PROXY_${T}_TOKEN`, e) || null,
    authHeader: HEADER_RE.test(hdr) ? hdr : 'authorization',
    tokenMode: env(`CONTROL704_PROXY_${T}_TOKEN_MODE`, e).toLowerCase() === 'avrone-jwt' ? 'avrone-jwt' : 'static',
    policy
  };
}

export function loadTargets(e: NodeJS.ProcessEnv = process.env): TargetConfig[] {
  return TARGET_IDS.map(id => loadTarget(id, e));
}

/** Public, secret-free view for dashboards and agent tools. */
export function describeTarget(t: TargetConfig, role?: Role | null) {
  return {
    id: t.id,
    label: t.label,
    authMode: t.authMode,
    configured: t.configured,
    status: t.configured ? 'configured' : t.configError ? `misconfigured: ${t.configError}` : 'not configured',
    host: t.base ? t.base.host : null,
    credentialInjected: t.tokenMode === 'avrone-jwt' || Boolean(t.token),
    tokenMode: t.tokenMode,
    yourAccess: role ? t.policy[role] : null
  };
}
