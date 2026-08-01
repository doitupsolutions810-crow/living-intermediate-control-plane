import crypto from 'node:crypto';
import { buildAvroneContext } from './avrone-client.mjs';

export class ChatWire {
  constructor({ resonant, sessions = new Map() } = {}) {
    this.resonant = resonant;
    this.sessions = sessions;
  }

  static toolDescriptors() {
    return [
      { name: 'spectrum', description: 'Read current lattice spectrum' },
      { name: 'belief_tick', description: 'Advance belief field one step' }
    ];
  }

  createSession({ label = 'avrone', belief = 0.55, nodeId = 'avrone' } = {}) {
    const id = crypto.randomUUID();
    const session = {
      id,
      label,
      nodeId,
      belief: Number(belief),
      createdAt: new Date().toISOString()
    };
    this.sessions.set(id, session);
    if (this.resonant) this.resonant.tick(session.belief);
    return session;
  }

  prepareTurn(sessionId, { message = '', belief = null } = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw Object.assign(new Error('unknown session'), { statusCode: 404 });
    }
    if (belief != null) session.belief = Number(belief);
    const frame = this.resonant?.tick(session.belief) || null;
    const ctx = buildAvroneContext({
      resonant: this.resonant,
      message,
      beliefFragment: `node=${session.nodeId} belief=${session.belief}`
    });
    return {
      sessionId,
      message,
      frame,
      systemAugment: ctx.systemAugment,
      tools: ChatWire.toolDescriptors()
    };
  }
}
