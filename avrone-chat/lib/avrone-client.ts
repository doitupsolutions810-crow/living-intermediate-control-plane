export type LatticeContext = {
  systemAugment?: string;
  spectrum?: unknown;
  offline?: boolean;
};

function platformBase() {
  return (process.env.CONTROL12_PLATFORM_URL || '').replace(/\/$/, '');
}

function platformHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = process.env.CONTROL12_PLATFORM_TOKEN || '';
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchLatticeTurn(
  message: string,
  belief = 0.55
): Promise<LatticeContext> {
  const platformUrl = platformBase();
  if (!platformUrl) {
    return { offline: true, systemAugment: 'Lattice offline (CONTROL12_PLATFORM_URL unset).' };
  }

  const headers = platformHeaders();

  try {
    const sessionRes = await fetch(`${platformUrl}/api/v1/chat/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ label: 'avrone', belief }),
      signal: AbortSignal.timeout(8000)
    });
    if (!sessionRes.ok) return { offline: true, systemAugment: 'Lattice session rejected.' };
    const session = await sessionRes.json();
    const turnRes = await fetch(`${platformUrl}/api/v1/chat/turn`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId: session.id, message, belief }),
      signal: AbortSignal.timeout(8000)
    });
    if (!turnRes.ok) return { offline: true, systemAugment: 'Lattice turn rejected.' };
    const turn = await turnRes.json();
    return { systemAugment: turn.systemAugment, spectrum: turn.frame, offline: false };
  } catch {
    return { offline: true, systemAugment: 'Lattice unreachable.' };
  }
}

export async function fetchPlatformSnapshot() {
  const platformUrl = platformBase();
  const out: Record<string, unknown> = {
    platformConfigured: Boolean(platformUrl)
  };
  if (!platformUrl) {
    out.platform = { ok: false };
    return out;
  }

  const headers = platformHeaders();
  delete headers['content-type'];

  try {
    const [health, security, spectrum] = await Promise.all([
      fetch(`${platformUrl}/health`, { headers, signal: AbortSignal.timeout(8000) }),
      fetch(`${platformUrl}/api/v1/security/status`, {
        headers,
        signal: AbortSignal.timeout(8000)
      }),
      fetch(`${platformUrl}/api/v1/audio/spectrum`, {
        headers,
        signal: AbortSignal.timeout(8000)
      })
    ]);
    out.health = health.ok ? await health.json() : { ok: false, status: health.status };
    out.security = security.ok ? await security.json() : null;
    if (out.security && typeof out.security === 'object') {
      const sec = out.security as {
        severity?: string;
        anomalies?: unknown;
        lattice?: { belief?: number; tension?: number; partials?: number };
        mtls?: boolean;
        dualCa?: boolean;
        chatOpen?: boolean;
        requireQuorum?: boolean;
      };
      out.anomalies = sec.anomalies ?? { severity: sec.severity };
      out.lattice = sec.lattice ?? null;
      out.mtls = sec.mtls;
      out.dualCa = sec.dualCa;
      out.chatOpen = sec.chatOpen;
      out.requireQuorum = sec.requireQuorum;
      out.severity = sec.severity;
    } else {
      out.anomalies = null;
      out.lattice = null;
    }
    out.spectrum = spectrum.ok ? await spectrum.json() : null;
    out.platform = { ok: health.ok };
  } catch (e) {
    out.platform = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  return out;
}
