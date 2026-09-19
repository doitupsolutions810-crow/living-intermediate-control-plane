import { fetchPlatformSnapshot } from '../../../lib/avrone-client';
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
