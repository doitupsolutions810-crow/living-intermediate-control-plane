export type LatticeContext = {
  systemAugment?: string;
  spectrum?: unknown;
  offline?: boolean;
};

export async function fetchLatticeTurn(
  message: string,
  belief = 0.55
): Promise<LatticeContext> {
  const platformUrl = (process.env.CONTROL12_PLATFORM_URL || '').replace(/\/$/, '');
  const token = process.env.CONTROL12_PLATFORM_TOKEN || '';
  if (!platformUrl) return { offline: true, systemAugment: 'Lattice offline.' };

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const sessionRes = await fetch(`${platformUrl}/api/v1/chat/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ label: 'avrone', belief }),
      signal: AbortSignal.timeout(8000)
    });
    if (!sessionRes.ok) return { offline: true };
    const session = await sessionRes.json();
    const turnRes = await fetch(`${platformUrl}/api/v1/chat/turn`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId: session.id, message, belief }),
      signal: AbortSignal.timeout(8000)
    });
    if (!turnRes.ok) return { offline: true };
    const turn = await turnRes.json();
    return { systemAugment: turn.systemAugment, spectrum: turn.frame, offline: false };
  } catch {
    return { offline: true, systemAugment: 'Lattice unreachable.' };
  }
}
