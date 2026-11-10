/**
 * Route-handler guard (Node runtime). Middleware already rejects missing or
 * forged cookies; this re-verifies (defense in depth) and re-checks the
 * account still exists so removing/downgrading an account in
 * CONTROL704_ACCOUNTS takes effect without waiting for the cookie to expire.
 */

import { findAccount } from './accounts';
import { hasRole, minRole, type Role } from './roles';
import { readCookie, SESSION_COOKIE, verifySession } from './session';

export interface Caller {
  sub: string;
  role: Role;
  exp: number;
}

export async function sessionFromCookieHeader(cookieHeader: string | null | undefined): Promise<Caller | null> {
  const p = await verifySession(readCookie(cookieHeader, SESSION_COOKIE));
  if (!p) return null;
  const acct = findAccount(p.sub);
  if (!acct) return null;
  return { sub: acct.id, role: minRole(p.role, acct.role), exp: p.exp };
}

export async function getCaller(req: Request): Promise<Caller | null> {
  return sessionFromCookieHeader(req.headers.get('cookie'));
}

export function json(status: number, body: unknown, headers?: Record<string, string>): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

/** Returns a Response when the caller is not allowed, else the caller. */
export async function requireRole(req: Request, need: Role): Promise<Caller | Response> {
  const c = await getCaller(req);
  if (!c) return json(401, { error: 'unauthenticated' });
  if (!hasRole(c.role, need)) return json(403, { error: 'forbidden', need, have: c.role });
  return c;
}

/** CSRF: state-changing requests must come from our own origin. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site';
  try {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
