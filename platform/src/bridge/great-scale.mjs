/**
 * Great Scale bridge — coherent geometry ↔ living-intermediate belief.
 *
 * Canonical invariant source: doitupsolutions810-crow/great-scale (observer).
 * heat(h) = h(1-h) ≡ tension(B) = B(1-B).
 *
 * Dual-cone (GS-UCL v1.3):
 *   CONE_BRIDGE = φ^{-2}  (this module; soft-map / QGT additive floor)  [legacy CONE]
 *   CONE_ORBIT  = φ^{-3} = φ^{-1}−φ^{-2} = √5−2  (observer spindle residual)
 *   DELTA       = CONE_BRIDGE − CONE_ORBIT = φ^{-4}  (path-invariant gap)
 * Ψ_bridge(t) = Ψ_orbit(t) + DELTA; residual heat S is shared across embeddings.
 * Unification identifies DELTA; does not erase either floor.
 * Joint agreement: A* = (4+3)/9 = 7/9 on the ninefold.
 */
import { tension, integrateBeliefStep } from '../audio/jacobian.mjs';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const PHI_INV = PHI - 1;
export const CONE_BRIDGE = PHI_INV * PHI_INV;           // φ^{-2}
export const CONE_ORBIT = PHI_INV - CONE_BRIDGE;         // φ^{-3} = √5−2
export const DELTA = CONE_BRIDGE - CONE_ORBIT;           // φ^{-4}
/** @deprecated Use CONE_BRIDGE; retained for backward compatibility */
export const CONE = CONE_BRIDGE;
export const RATE = 0.85;
export const RESIDUAL_DIMS = Object.freeze([4, 3, 1]);
export const A_STAR = (4 + 3) / 9;                      // 7/9 structural agreement

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
  'only add scale-generated geometry',
  'dual-cone residual δ = φ^{-4} path-invariant',
  'joint agreement A* = (4+3)/9 = 7/9'
]);

export function heat(h) {
  const x = Number(h);
  if (!Number.isFinite(x)) return 0;
  return x * (1 - x);
}

export function stateAt(t, rate = RATE) {
  const phase = ((Number(t) || 0) * rate) % 1;
  const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
  const S = heat(h);
  const n = 8 - 4 * S;
  const lam = Math.pow(PHI, -n);
  const psi = CONE + S;
  return {
    schema: 'great-scale.state/v1.3',
    phase, h, S, n, lam, psi, fold: 0.8, zero_mode: PHI,
    residual: RESIDUAL_DIMS, cone: CONE,
    cone_bridge: CONE_BRIDGE, cone_orbit: CONE_ORBIT, delta: DELTA,
    a_star: A_STAR
  };
}

export function beliefToScale(belief) {
  const B = clamp01(belief);
  const S = tension(B);
  const n = 8 - 4 * S;
  return {
    schema: 'great-scale.belief-map/v1.3',
    belief: B, h: B, S, tension: S, n,
    lam: Math.pow(PHI, -n),
    psi: Math.max(CONE, CONE + S),
    zero_mode: PHI, cone: CONE, view: 'Observer',
    cone_bridge: CONE_BRIDGE, cone_orbit: CONE_ORBIT, delta: DELTA
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

export function snapshotFromBelief(belief, { t = Date.now() / 1000, view = 'Observer' } = {}) {
  const map = beliefToScale(belief);
  const st = stateAt(t);
  const preset = VIEW_PRESETS[view] || VIEW_PRESETS.Observer;
  return {
    schema: 'great-scale.bridge/v1.3',
    at: new Date().toISOString(),
    version: '0.5.0-bridge-dual-cone',
    laws: LAWS,
    belief: map,
    phaseTime: st,
    camera: preset,
    xyz: phaseXYZ(map.h, map.S),
    coherence: {
      tensionEqualsHeat: true,
      formula: 'S = B(1-B) = heat(h)',
      coneFloor: CONE,
      coneOrbit: CONE_ORBIT,
      coneBridge: CONE_BRIDGE,
      delta: DELTA,
      aStar: A_STAR,
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
  PHI, CONE, CONE_BRIDGE, CONE_ORBIT, DELTA, A_STAR, RATE, heat, stateAt,
  beliefToScale, scaleToBeliefStep, phaseXYZ, snapshotFromBelief,
  VIEW_PRESETS, LAWS, RESIDUAL_DIMS
};
