/**
 * Node → AVRONE Python production stack adapter.
 * Calls OpenAI-compatible /v1/chat/completions on the FastAPI control plane
 * and injects lattice observations into the system channel.
 */

import { buildLatticeObservation, toReactObservationStep } from './lattice-observation.mjs';

const DEFAULT_TIMEOUT_MS = 120_000;

export class AvroneStackAdapter {
  /**
   * @param {{ baseUrl?: string, token?: string, timeoutMs?: number, resonant?: object }} opts
   */
  constructor({
    baseUrl = process.env.AVRONE_STACK_URL || 'http://127.0.0.1:8000',
    token = process.env.AVRONE_STACK_TOKEN || '',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    resonant = null,
    getSecurityStatus = null,
    getFederationSnapshot = null
  } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.resonant = resonant;
    this.getSecurityStatus = getSecurityStatus;
    this.getFederationSnapshot = getFederationSnapshot;
  }

  async observe({ belief = null, nodeId = 'lattice', sessionId = null } = {}) {
    let securityStatus = null;
    let federationSnapshot = null;
    let spectrum = null;

    if (typeof this.getSecurityStatus === 'function') {
      try {
        securityStatus = await this.getSecurityStatus();
      } catch {
        securityStatus = { severity: 'unreachable' };
      }
    }
    if (typeof this.getFederationSnapshot === 'function') {
      try {
        federationSnapshot = await this.getFederationSnapshot();
      } catch {
        federationSnapshot = null;
      }
    }
    if (this.resonant) {
      try {
        spectrum = {
          fragment: this.resonant.toPromptFragment?.() || '',
          ...(typeof this.resonant.snapshot === 'function' ? this.resonant.snapshot() : {})
        };
      } catch {
        spectrum = null;
      }
    }

    const payload = buildLatticeObservation({
      securityStatus,
      spectrum,
      federationSnapshot,
      belief,
      nodeId,
      sessionId
    });
    return {
      observation: payload,
      reactStep: toReactObservationStep(payload)
    };
  }

  async route({
    message,
    sessionId = null,
    model = null,
    temperature = 0.7,
    maxTokens = null,
    belief = null,
    stream = false
  }) {
    const { observation, reactStep } = await this.observe({ belief, sessionId });
    const system = [
      'You are operating inside the AVRONE production stack under Control12 lattice attestation.',
      'When tools are available, reason step-by-step (Thought \u2192 Action \u2192 Observation) before the final answer.',
      'Lattice observation (provisional):',
      observation.observation,
      'Prefer provisional language; never claim absolute certainty.'
    ].join('\n');

    const body = {
      model: model || undefined,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: String(message || '') }
      ],
      session_id: sessionId || undefined,
      temperature,
      max_tokens: maxTokens || undefined,
      stream: Boolean(stream)
    };

    const headers = {
      'content-type': 'application/json',
      accept: stream ? 'text/event-stream' : 'application/json'
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          error: {
            status: res.status,
            detail: errText.slice(0, 800) || res.statusText
          },
          lattice: observation,
          reactStep
        };
      }
      if (stream) {
        return {
          stream: true,
          response: res,
          lattice: observation,
          reactStep
        };
      }
      const data = await res.json();
      return {
        ...data,
        lattice: observation,
        reactStep,
        routed_to: data.routed_to || 'avrone-stack'
      };
    } catch (err) {
      return {
        error: {
          status: 0,
          detail: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err)
        },
        lattice: observation,
        reactStep
      };
    } finally {
      clearTimeout(timer);
    }
  }

  healthUrl() {
    return `${this.baseUrl}/v1/models`;
  }

  async probe() {
    try {
      const res = await fetch(this.healthUrl(), {
        method: 'GET',
        headers: this.token ? { authorization: `Bearer ${this.token}` } : {},
        signal: AbortSignal.timeout(5000)
      });
      return { ok: res.ok, status: res.status, baseUrl: this.baseUrl };
    } catch (err) {
      return { ok: false, status: 0, baseUrl: this.baseUrl, error: String(err?.message || err) };
    }
  }
}

export default AvroneStackAdapter;
