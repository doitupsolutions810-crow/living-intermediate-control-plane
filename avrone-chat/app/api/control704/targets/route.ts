import { json, requireRole } from '../../../../lib/control704/guard';
import { describeTarget, loadTargets } from '../../../../lib/control704/targets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const c = await requireRole(req, 'viewer');
  if (c instanceof Response) return c;
  return json(200, { targets: loadTargets().map(t => describeTarget(t, c.role)) });
}
