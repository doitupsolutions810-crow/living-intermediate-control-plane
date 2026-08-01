export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const platformUrl = (process.env.CONTROL12_PLATFORM_URL || '').replace(/\/$/, '');
  const token = process.env.CONTROL12_PLATFORM_TOKEN || '';
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;

  const out: Record<string, unknown> = {
    service: 'avrone-chat',
    observedAt: new Date().toISOString(),
    platformConfigured: Boolean(platformUrl)
  };

  if (!platformUrl) {
    out.platform = { ok: false };
    return Response.json(out);
  }

  try {
    const [health, anomalies, spectrum] = await Promise.all([
      fetch(`${platformUrl}/health`, { headers, signal: AbortSignal.timeout(8000) }),
      fetch(`${platformUrl}/api/v1/security/anomalies`, {
        headers,
        signal: AbortSignal.timeout(8000)
      }),
      fetch(`${platformUrl}/api/v1/audio/spectrum`, {
        headers,
        signal: AbortSignal.timeout(8000)
      })
    ]);
    out.health = health.ok ? await health.json() : { ok: false };
    out.anomalies = anomalies.ok ? await anomalies.json() : null;
    out.spectrum = spectrum.ok ? await spectrum.json() : null;
    out.platform = { ok: health.ok };
  } catch (e) {
    out.platform = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  return Response.json(out);
}
