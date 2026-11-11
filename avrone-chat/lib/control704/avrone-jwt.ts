/**
 * Avrone Due'Krey -> Control704 proxy token issuer.
 *
 * Mints short-lived HS256 JWTs in the format control704-proxy-system verifies
 * (doitupsolutions810-crow/control704-proxy-system, src/auth/avroneProvider.js):
 *   header  {"alg":"HS256","typ":"JWT"}
 *   claims  iss = AVRONE_ISSUER, aud = AVRONE_AUDIENCE, sub = technician id,
 *           roles = [role] (viewer | technician | admin), iat, exp (<= 300 s), jti
 *   key     AVRONE_JWT_SECRET (same value on both sides; >= 32 bytes, no surrounding
 *           whitespace, >= 8 distinct characters, mirroring the proxy's own checks)
 *
 * Edge-safe (Web Crypto only). Fails closed: proxyJwtConfig() returns null and
 * mintProxyToken() throws when the contract is not fully configured.
 * Secrets come only from the environment and are never logged or returned.
 */

import { isRole, type Role } from './roles';

export const PROXY_JWT_DEFAULT_TTL_S = 120;
export const PROXY_JWT_MIN_TTL_S = 30;
export const PROXY_JWT_MAX_TTL_S = 300;
export const PROXY_JWT_MIN_SECRET_BYTES = 32;

export interface ProxyJwtConfig {
  issuer: string;
  audience: string;
  secret: string;
  ttlS: number;
}

export interface ProxyJwtClaims {
  iss: string;
  aud: string;
  sub: string;
  roles: Role[];
  iat: number;
  exp: number;
  jti: string;
}

const enc = new TextEncoder();
// Same rule as the proxy's `sub` check: no C0/C1 controls, line/paragraph separators or
// format characters (zero-width, bidi), so audit logs on both sides cannot be spoofed.
const BAD_SUB = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\p{Cf}]/u;
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const b64urlJson = (v: unknown) => b64url(enc.encode(JSON.stringify(v)));

/** Why a secret is unusable, or null when it is acceptable. Never echoes the secret. */
export function secretProblem(secret: string): string | null {
  if (enc.encode(secret).length < PROXY_JWT_MIN_SECRET_BYTES) return `must be at least ${PROXY_JWT_MIN_SECRET_BYTES} bytes`;
  if (secret !== secret.trim()) return 'must not have leading or trailing whitespace';
  if (new Set(secret).size < 8) return 'has too little variety (fewer than 8 distinct characters)';
  return null;
}

/** Contract config from env, or null when any part is missing or weak (fail closed). */
export function proxyJwtConfig(e: NodeJS.ProcessEnv = process.env): ProxyJwtConfig | null {
  const issuer = (e.AVRONE_ISSUER || '').trim();
  const audience = (e.AVRONE_AUDIENCE || '').trim();
  const secret = e.AVRONE_JWT_SECRET || '';
  if (!issuer || !audience || !secret || secretProblem(secret)) return null;
  const n = Number(e.CONTROL704_PROXY_JWT_TTL_S || '');
  const ttlS = Number.isInteger(n) && n >= PROXY_JWT_MIN_TTL_S && n <= PROXY_JWT_MAX_TTL_S ? n : PROXY_JWT_DEFAULT_TTL_S;
  return { issuer, audience, secret, ttlS };
}

export function isValidSub(sub: unknown): sub is string {
  return typeof sub === 'string' && sub.length > 0 && sub.length <= 256 && !BAD_SUB.test(sub) && !LONE_SURROGATE.test(sub);
}

function randomJti(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return b64url(b);
}

/** Mint a proxy token for one technician. Throws on missing config or invalid sub/role. */
export async function mintProxyToken(
  sub: string,
  role: Role,
  opts?: { now?: number; config?: ProxyJwtConfig | null }
): Promise<{ token: string; claims: ProxyJwtClaims }> {
  const cfg = opts?.config === undefined ? proxyJwtConfig() : opts.config;
  if (!cfg) throw new Error('Control704 proxy JWT is not configured (AVRONE_ISSUER, AVRONE_AUDIENCE, AVRONE_JWT_SECRET)');
  const problem = secretProblem(cfg.secret);
  if (problem) throw new Error(`AVRONE_JWT_SECRET ${problem}`);
  if (!isValidSub(sub)) throw new Error('invalid subject for proxy token');
  if (!isRole(role)) throw new Error('invalid role for proxy token');
  const ttl = Math.min(Math.max(Math.floor(cfg.ttlS), PROXY_JWT_MIN_TTL_S), PROXY_JWT_MAX_TTL_S);
  const iat = Math.floor((opts?.now ?? Date.now()) / 1000);
  const claims: ProxyJwtClaims = { iss: cfg.issuer, aud: cfg.audience, sub, roles: [role], iat, exp: iat + ttl, jti: randomJti() };
  const signingInput = `${b64urlJson({ alg: 'HS256', typ: 'JWT' })}.${b64urlJson(claims)}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(cfg.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(signingInput)));
  return { token: `${signingInput}.${b64url(sig)}`, claims };
}
