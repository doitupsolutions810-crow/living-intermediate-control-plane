/**
 * Living intermediate — additive partial field driven by belief Jacobian.
 */

import { integrateBeliefStep, spectralTilt, tension } from './jacobian.mjs';

export class LivingIntermediate {
  constructor({ partials = 8, label = 'living' } = {}) {
    this.label = label;
    this.belief = 0.55;
    this.partials = Array.from({ length: partials }, (_, i) => ({
      n: i + 1,
      amp: spectralTilt(0.55, i + 1),
      phase: 0
    }));
    this.history = [];
  }

  tick(belief, otherBelief = null) {
    if (belief != null) this.belief = Number(belief);
    const coupling =
      otherBelief != null ? (Number(otherBelief) - this.belief) * 0.1 : 0;
    this.belief = integrateBeliefStep(this.belief, { coupling, scale: 1 });
    const t = tension(this.belief);
    this.partials = this.partials.map((p, i) => ({
      ...p,
      amp: spectralTilt(this.belief, p.n),
      phase: (p.phase + 0.07 * (i + 1) * (0.5 + t)) % (Math.PI * 2)
    }));
    const frame = {
      at: new Date().toISOString(),
      belief: this.belief,
      tension: t,
      partials: this.partials.map(({ n, amp, phase }) => ({ n, amp, phase }))
    };
    this.history.push(frame);
    if (this.history.length > 64) this.history.shift();
    return frame;
  }

  silence() {
    this.partials = this.partials.map(p => ({ ...p, amp: 0 }));
    return this.getState();
  }

  getState() {
    return {
      label: this.label,
      belief: this.belief,
      tension: tension(this.belief),
      partials: this.partials
    };
  }

  getSpectrum() {
    return {
      bins: this.partials.map(p => ({ n: p.n, amp: p.amp })),
      partials: this.partials
    };
  }

  getHistory(limit = 8) {
    return this.history.slice(-limit);
  }

  toPromptFragment() {
    const t = tension(this.belief).toFixed(3);
    const b = this.belief.toFixed(3);
    return `[lattice belief=${b} tension=${t} partials=${this.partials.length}]`;
  }
}

export default LivingIntermediate;
