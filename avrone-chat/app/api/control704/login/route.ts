import { authenticate } from '../../../../lib/control704/accounts';
import { appendAudit } from '../../../../lib/control704/audit';
import { clientIp, json } from '../../../../lib/control704/guard';
import { rateLimit } from '../../../../lib/control704/ratelimit';
import { authSecret, sessionCookieHeader, sessionTtlSeconds, signSession } from '../../../../lib/control704/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!authSecret()) return json(503, { error: 'auth_not_configured' });

  const ip = clientIp(req);
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60_000);
  if (!rl.ok) return json(429, { error: 'rate_limited' }, { 'retry-after': String(rl.retryAfterS) });

  let body: { id?: unknown; key?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const id = String(body.id ?? '').trim().slice(0, 64);
  const key = String(body.key ?? '').slice(0, 256);
  if (!id || !key) return json(400, { error: 'id_and_key_required' });

  const acct = authenticate(id, key);
  if (!acct) {
    appendAudit({ actor: id, role: 'none', action: 'auth.login', outcome: 'denied', detail: { ip } });
    return json(401, { error: 'invalid_credentials' });
  }

  const ttl = sessionTtlSeconds();
  const token = await signSession(acct.id, acct.role, { ttlS: ttl });
  const secure = new URL(req.url).protocol === 'https:' || process.env.NODE_ENV === 'production';
  appendAudit({ actor: acct.id, role: acct.role, action: 'auth.login', outcome: 'ok', detail: { ip } });
  return json(200, { ok: true, sub: acct.id, role: acct.role, expiresInS: ttl }, { 'set-cookie': sessionCookieHeader(token, ttl, secure) });
}
