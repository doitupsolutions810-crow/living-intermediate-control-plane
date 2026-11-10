/**
 * Control704 proxy: /api/proxy/{x|y|z}/<path...>
 * Session required (middleware + re-check here); policy enforced in lib/control704/proxy.
 */

import { getCaller, json } from '../../../../../lib/control704/guard';
import { MAX_REQUEST_BYTES, proxyRequest } from '../../../../../lib/control704/proxy';
import { isTargetId } from '../../../../../lib/control704/targets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { target: string; path?: string[] } };

async function handle(req: Request, { params }: Ctx): Promise<Response> {
  const caller = await getCaller(req);
  if (!caller) return json(401, { error: 'unauthenticated' });
  const target = String(params.target || '').toLowerCase();
  if (!isTargetId(target)) return json(404, { error: 'unknown_target', allowed: ['x', 'y', 'z'] });

  let body: ArrayBuffer | null = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_REQUEST_BYTES) return json(413, { error: 'request_too_large', maxBytes: MAX_REQUEST_BYTES });
    body = await req.arrayBuffer();
  }

  const url = new URL(req.url);
  const r = await proxyRequest({
    target,
    method: req.method,
    segments: params.path || [],
    search: url.search,
    headers: req.headers,
    body,
    actor: { sub: caller.sub, role: caller.role },
    via: 'http'
  });
  return new Response(req.method === 'HEAD' ? null : (r.body as BodyInit), {
    status: r.status,
    headers: { ...r.headers, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
