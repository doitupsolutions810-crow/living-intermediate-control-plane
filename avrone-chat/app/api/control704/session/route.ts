import { getCaller, json } from '../../../../lib/control704/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const c = await getCaller(req);
  if (!c) return json(401, { error: 'unauthenticated' });
  return json(200, { sub: c.sub, role: c.role, expiresAt: new Date(c.exp * 1000).toISOString() });
}
