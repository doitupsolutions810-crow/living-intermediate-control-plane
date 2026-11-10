import { appendAudit } from '../../../../lib/control704/audit';
import { json, requireRole } from '../../../../lib/control704/guard';
import {
  activeOverrides,
  baseDatasets,
  effectiveDataset,
  revertOverride,
  submitOverride,
  type OverrideRequest
} from '../../../../lib/control704/override';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Datasets + active overrides (technician+ read). */
export async function GET(req: Request) {
  const c = await requireRole(req, 'technician');
  if (c instanceof Response) return c;
  const names = Object.keys(baseDatasets());
  return json(200, {
    datasets: names.map(n => ({ name: n, effective: effectiveDataset(n) })),
    active: activeOverrides()
  });
}

/**
 * Admin-only break-glass.
 *   {dataset,key,value,reason,expiresAt?|ttlMinutes?,dryRun?:true}   → preview diff
 *   {...same, dryRun:false, confirm:true}                            → apply
 *   {op:"revert", id, reason}                                        → revert
 */
export async function POST(req: Request) {
  const c = await requireRole(req, 'viewer');
  if (c instanceof Response) return c;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  if (c.role !== 'admin') {
    appendAudit({ actor: c.sub, role: c.role, action: 'override.denied', target: String(body.dataset ?? body.id ?? '?'), outcome: 'denied', detail: { why: 'admin_required' } });
    return json(403, { error: 'admin_required' });
  }
  if (body.op === 'revert') {
    const r = revertOverride(String(body.id ?? ''), String(body.reason ?? ''), c);
    return json(r.status, r);
  }
  const out = submitOverride(body as unknown as OverrideRequest, c);
  return json(out.ok ? 200 : out.status, out);
}
