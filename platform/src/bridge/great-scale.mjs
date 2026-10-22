/**
 * Great Scale bridge — coherent geometry ↔ living-intermediate belief.
 *
 * Identity (provisional, not a claim of certainty):
 *   heat(h) = h(1-h)  ≡  tension(belief) = B(1-B)
 *
 * Laws (from great-scale repo):
 *   - keep the mean (zero-mode ≈ φ)
 *   - residual partition 4+3+1
 *   - Ψ never below cone φ⁻², matching Great Scale's public contract
 *   - only add scale-generated geometry
 */

import { tension, integrateBeliefStep } from '../audio/jacobian.mjs';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const PHI_INV = PHI - 1;
export const CONE = PHI_INV * PHI_INV;
export const RATE = 0.85;
export const RESIDUAL_DIMS = Object.freeze([4, 3, 1]);

export const VIEW_PRESETS = Object.freeze({
  Watch: { az: 35, el: 25 },
  Observer: { az: 0, el: 80 },
  Forward: { az: 90, el: 15 },
  Adjacent: { az: -40, el: 20 },
  Down: { az: 0, el: -55 }
});

export const LAWS = Object.freeze([
  'keep the mean',
  'respect residual partition 4+3+1',
  'Ψ never below cone',
  'only add scale-generated geometry'
]);

export function heat(h) {
  const x = Number(h);
  if (!Number.isFinite(x)) return 0;
  return x * (1 - x);
}

export function stateAt(t, rate = RATE) {
  const time = Number(t);
  const phaseRate = Number(rate);
  if (!Number.isFinite(time) || !Number.isFinite(phaseRate)) {
    throw new TypeError('phase time t and rate must be finite');
  }
  const cycles = time * phaseRate;
  if (!Number.isFinite(cycles)) throw new RangeError('phase product t * rate must be finite');
  const phase = ((cycles % 1) + 1) % 1;
  const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
  const S = heat(h);
  const n = 8 - 4 * S;
  const lam = Math.pow(PHI, -n);
  const psi = CONE + S;
  return {
    schema: 'great-scale.state/v1',
    phase,
    h,
    S,
    n,
    lam,
    psi,
    fold: 0.8,
    zero_mode: PHI,
    residual: RESIDUAL_DIMS,
    cone: CONE
  };
}

export function beliefToScale(belief) {
  const B = clamp01(belief);
  const S = tension(B);
  const n = 8 - 4 * S;
  return {
    schema: 'great-scale.belief-map/v1',
    belief: B,
    h: B,
    S,
    tension: S,
    n,
    lam: Math.pow(PHI, -n),
    psi: Math.max(CONE, CONE + S),
    zero_mode: PHI,
    cone: CONE,
    view: 'Observer'
  };
}

export function scaleToBeliefStep(currentBelief, scaleState, { scale = 0.05 } = {}) {
  const targetH = scaleState?.h != null ? Number(scaleState.h) : 0.5;
  const delta = targetH - clamp01(currentBelief);
  return integrateBeliefStep(currentBelief, { delta, scale });
}

export function phaseXYZ(phase, S) {
  const th = 2 * Math.PI * (Number(phase) || 0);
  const r = 1 + 0.12 * Math.sin(th * 2);
  const height = (Number(S) || 0) * 3.5;
  return [r * Math.cos(th), height, r * Math.sin(th)];
}

export function snapshotFromBelief(belief, { t = Date.now() / 1000, rate = RATE, view = 'Observer' } = {}) {
  const map = beliefToScale(belief);
  const st = stateAt(t, rate);
  const preset = VIEW_PRESETS[view] || VIEW_PRESETS.Observer;
  return {
    schema: 'great-scale.bridge/v1',
    at: new Date().toISOString(),
    version: '0.4.0-bridge',
    laws: LAWS,
    belief: map,
    phaseTime: st,
    camera: preset,
    xyz: phaseXYZ(map.h, map.S),
    coherence: {
      tensionEqualsHeat: true,
      formula: 'S = B(1-B) = heat(h)',
      coneFloor: CONE,
      phi: PHI
    }
  };
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export default {
  PHI,
  CONE,
  RATE,
  heat,
  stateAt,
  beliefToScale,
  scaleToBeliefStep,
  phaseXYZ,
  snapshotFromBelief,
  VIEW_PRESETS,
  LAWS
};
