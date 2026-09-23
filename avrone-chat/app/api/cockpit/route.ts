import { fetchPlatformSnapshot, postCockpitAction } from '../../../lib/avrone-client';
import { probeEvidenceConsole } from '../../../lib/evidence-console';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const platform = await fetchPlatformSnapshot();
  const evidenceConsole = await probeEvidenceConsole({ acceptLocal: true });

  return Response.json({
    service: 'avrone-chat',
    observedAt: new Date().toISOString(),
    ...platform,
    evidenceConsole
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }
  const action = String(body.action || '');
  if (!action) {
    return Response.json({ error: 'action required' }, { status: 400 });
  }
  const result = await postCockpitAction(action, body);
  const status = typeof result.status === 'number' && result.status >= 400 ? result.status : 200;
  return Response.json(
    {
      service: 'avrone-chat',
      observedAt: new Date().toISOString(),
      ...result
    },
    { status }
  );
}
