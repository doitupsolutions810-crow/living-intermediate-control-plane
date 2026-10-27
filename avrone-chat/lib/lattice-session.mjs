/**
 * @typedef {{
 *   systemAugment?: string,
 *   spectrum?: unknown,
 *   offline?: boolean,
 *   sessionId?: string
 * }} LatticeTurnResult
 */

/**
 * @param {{
 *   baseUrl: string,
 *   headers: Record<string, string>,
 *   message: string,
 *   belief?: number,
 *   sessionId?: string | null,
 *   fetchImpl?: typeof fetch
 * }} options
 * @returns {Promise<LatticeTurnResult>}
 */
export async function fetchLatticeSessionTurn({
  baseUrl,
  headers,
  message,
  belief = 0.55,
  sessionId = null,
  fetchImpl = fetch
}) {
  const request = (url, body) =>
    fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });

  try {
    let activeSessionId = sessionId;
    let turnResponse = null;
    if (activeSessionId) {
      turnResponse = await request(`${baseUrl}/api/v1/chat/turn`, {
        sessionId: activeSessionId,
        message,
        belief
      });
      if (turnResponse.status === 404) {
        activeSessionId = null;
        turnResponse = null;
      } else if (!turnResponse.ok) {
        return {
          offline: true,
          systemAugment: `Lattice turn rejected (HTTP ${turnResponse.status}).`
        };
      }
    }

    if (!activeSessionId) {
      const sessionResponse = await request(`${baseUrl}/api/v1/chat/session`, {
        label: 'avrone',
        belief
      });
      if (!sessionResponse.ok) {
        return {
          offline: true,
          systemAugment: `Lattice session rejected (HTTP ${sessionResponse.status}).`
        };
      }

      const session = await sessionResponse.json();
      if (!session || typeof session.id !== 'string' || !session.id) {
        return {
          offline: true,
          systemAugment: 'Lattice returned an invalid session response.'
        };
      }
      activeSessionId = session.id;
    }

    if (!turnResponse) {
      turnResponse = await request(`${baseUrl}/api/v1/chat/turn`, {
        sessionId: activeSessionId,
        message,
        belief
      });
    }
    if (!turnResponse.ok) {
      return {
        offline: true,
        systemAugment: `Lattice turn rejected (HTTP ${turnResponse.status}).`
      };
    }

    const turn = await turnResponse.json();
    if (!turn || typeof turn !== 'object' || Array.isArray(turn)) {
      return {
        offline: true,
        systemAugment: 'Lattice returned an invalid turn response.'
      };
    }
    return {
      systemAugment: typeof turn.systemAugment === 'string' ? turn.systemAugment : undefined,
      spectrum: turn.frame,
      offline: false,
      sessionId: activeSessionId
    };
  } catch {
    return {
      offline: true,
      systemAugment: 'Lattice unreachable.'
    };
  }
}
