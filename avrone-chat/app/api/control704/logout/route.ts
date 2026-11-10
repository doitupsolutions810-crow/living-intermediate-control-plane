import { appendAudit } from '../../../../lib/control704/audit';
import { getCaller, json } from '../../../../lib/control704/guard';
import { clearSessionCookieHeader } from '../../../../lib/control704/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const c = await getCaller(req);
  if (c) appendAudit({ actor: c.sub, role: c.role, action: 'auth.logout', outcome: 'ok' });
  const secure = new URL(req.url).protocol === 'https:' || process.env.NODE_ENV === 'production';
  return json(200, { ok: true }, { 'set-cookie': clearSessionCookieHeader(secure) });
}
