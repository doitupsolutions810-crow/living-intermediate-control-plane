/**
 * Control704 signed session tokens (HMAC-SHA256, Web Crypto).
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC(secret, payloadPart))
 * Edge-safe: used by middleware.ts and Node route handlers alike.
 * Secret: AVRONE_AUTH_SECRET (>= 32 chars). Missing/short secret => every
 * verification fails closed.
 */

import { isRole, type Role } from './roles';

export const SESSION_COOKIE = 'c704_session';
export const DEFAULT_SESSION_TTL_S = 8 * 60 * 60; // 8h
export const MIN_SECRET_LEN = 32;

export interface SessionPayload {
  v: 1;
  sub: string;
  role: Role;
  iat: number; // epoch seconds
  exp: number; // epoch seconds
  jti: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
  const bin = atob(norm + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function authSecret(): string | null {
  const s = (process.env.AVRONE_AUTH_SECRET || '').trim();
  return s.length >= MIN_SECRET_LEN ? s : null;
}

export function sessionTtlSeconds(): number {
  const n = Number(process.env.CONTROL704_SESSION_TTL_S || '');
  if (Number.isFinite(n) && n >= 300 && n <= 7 * 24 * 3600) return Math.floor(n);
  return DEFAULT_SESSION_TTL_S;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function randomId(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return b64urlEncode(b);
}

export async function signSession(
  sub: string,
  role: Role,
  opts?: { ttlS?: number; now?: number; secret?: string }
): Promise<string> {
  const secret = opts?.secret ?? authSecret();
  if (!secret) throw new Error('AVRONE_AUTH_SECRET missing or shorter than 32 chars');
  const now = Math.floor((opts?.now ?? Date.now()) / 1000);
  const payload: SessionPayload = {
    v: 1,
    sub,
    role,
    iat: now,
    exp: now + (opts?.ttlS ?? sessionTtlSeconds()),
    jti: randomId()
  };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

/** Returns the payload when the token is authentic and unexpired, else null. Never throws. */
export async function verifySession(
  token: string | null | undefined,
  opts?: { now?: number; secret?: string }
): Promise<SessionPayload | null> {
  try {
    const secret = opts?.secret ?? authSecret();
    if (!secret || !token || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const key = await hmacKey(secret);
    // crypto.subtle.verify is constant-time for HMAC
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(dec.decode(b64urlDecode(body))) as Partial<SessionPayload>;
    if (p.v !== 1 || typeof p.sub !== 'string' || !p.sub || !isRole(p.role)) return null;
    if (typeof p.exp !== 'number' || typeof p.iat !== 'number') return null;
    const now = Math.floor((opts?.now ?? Date.now()) / 1000);
    if (p.exp <= now || p.iat > now + 60) return null;
    return p as SessionPayload;
  } catch {
    return null;
  }
}

/** Parse one cookie from a Cookie header. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function sessionCookieHeader(token: string, maxAgeS: number, secure = true): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeS}`,
    secure ? 'Secure' : ''
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearSessionCookieHeader(secure = true): string {
  return [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0', secure ? 'Secure' : '']
    .filter(Boolean)
    .join('; ');
}
