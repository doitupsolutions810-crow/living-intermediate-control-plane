import { listAudit, verifyAuditChain } from '../../../../lib/control704/audit';
import { json, requireRole } from '../../../../lib/control704/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const c = await requireRole(req, 'viewer');
  if (c instanceof Response) return c;
  const limit = Number(new URL(req.url).searchParams.get('limit') || 25);
  return json(200, { chain: verifyAuditChain(), entries: listAudit(limit) });
}
