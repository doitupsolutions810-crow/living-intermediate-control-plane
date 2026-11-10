/**
 * Control704 access gate (Edge middleware).
 *
 * Protects:
 *   /control704/*            pages  → redirect to /control704/login when no valid session
 *   /api/control704/*        API    → 401 JSON (login/logout are public)
 *   /api/proxy/*             API    → 401 JSON
 * Cross-site state-changing requests are rejected (CSRF), and every route
 * handler re-verifies the session itself (defense in depth).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/control704/session';

const PUBLIC_PATHS = new Set(['/control704/login', '/api/control704/login', '/api/control704/logout']);
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function deny(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { 'cache-control': 'no-store' } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (UNSAFE.has(req.method)) {
    const origin = req.headers.get('origin');
    if (origin) {
      let ok = false;
      try {
        ok = new URL(origin).host === req.nextUrl.host || new URL(origin).host === req.headers.get('host');
      } catch {
        ok = false;
      }
      if (!ok) return deny(403, 'cross_origin_blocked');
    } else if (req.headers.get('sec-fetch-site') === 'cross-site') {
      return deny(403, 'cross_origin_blocked');
    }
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (isApi) return deny(401, 'unauthenticated');
    const url = req.nextUrl.clone();
    url.pathname = '/control704/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/control704/:path*', '/api/control704/:path*', '/api/proxy/:path*']
};
