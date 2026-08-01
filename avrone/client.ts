// Avrone Due’Krey client bridge — Living Intermediate Control Plane
// Source of truth: control12-lattice-ops/avrone-chat
// Authenticated via Control704 proxy X/Y/Z data-set code override

export interface AvroneHealth {
  status: string;
  lattice: string;
  ready: boolean;
}

export interface CockpitAction {
  action: string;
  payload?: Record<string, unknown>;
}

export async function getAvroneHealth(baseUrl = process.env.AVRONE_BASE_URL || 'https://avrone-due-krey-chat.vercel.app'): Promise<AvroneHealth> {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    if (!res.ok) return { status: 'degraded', lattice: 'unknown', ready: false };
    const data = await res.json();
    return { status: data.status || 'ok', lattice: data.lattice || 'control12', ready: true };
  } catch {
    return { status: 'unreachable', lattice: 'offline', ready: false };
  }
}

export async function postCockpitAction(action: CockpitAction, baseUrl = process.env.AVRONE_BASE_URL || 'https://avrone-due-krey-chat.vercel.app') {
  const res = await fetch(`${baseUrl}/api/cockpit/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  return res.json();
}
