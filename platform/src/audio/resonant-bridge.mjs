/**
 * ResonantBridge — façade over LivingIntermediate for agents and chat.
 */

import { LivingIntermediate } from './living-intermediate.mjs';

export class ResonantBridge {
  constructor(opts = {}) {
    this.organ = new LivingIntermediate(opts);
  }

  tick(belief, otherBelief) {
    return this.organ.tick(belief, otherBelief);
  }

  silence() {
    return this.organ.silence();
  }

  getState() {
    return this.organ.getState();
  }

  getSpectrum() {
    return this.organ.getSpectrum();
  }

  getHistory(limit) {
    return this.organ.getHistory(limit);
  }

  toPromptFragment() {
    return this.organ.toPromptFragment();
  }
}

export default ResonantBridge;
