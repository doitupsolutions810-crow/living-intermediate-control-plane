/**
 * Great Scale Living Intermediate — shared residual coordinate (ESM)
 * Single source of truth for the logarithmic golden cascade.
 * Dual of great-scale/public/residual.cjs
 */
const PHI = (1 + Math.sqrt(5)) / 2;
const PHI_INV = PHI - 1;
const CONE = PHI_INV * PHI_INV; // φ^{-2}
const FIXED = 4.5;
const RESIDUAL_PARTITION = Object.freeze([4, 3, 1]);
const DUAL_ATLAS = Object.freeze({ 4: 'Watch', 3: 'Observer', 1: 'Forward' });

export function heat(h) {
  const x = Math.max(0, Math.min(1, Number(h) || 0));
  return x * (1 - x);
}

export function residualCount(S) {
  return 8 - 4 * S;
}

export function cascadeLambda(n) {
  return Math.pow(PHI, -n);
}

/** Logarithmic coordinate — the single generator */
export function logCoordinate(S) {
  return 4 * S;
}

export function psi(S) {
  return CONE + S;
}

/** Cone check — operational dual of the geometric floor */
export function coneCompliant(S) {
  return psi(S) >= CONE - 1e-12;
}

export function atlasRole(block) {
  return DUAL_ATLAS[block] || null;
}

/** Map topological saturation / polarization into cascade coordinate */
export function fromTopologicalSaturation(tau) {
  const t = Math.max(0, Math.min(1, Number(tau) || 0));
  const S = (1 - t * t) / 4;
  return {
    S,
    n: residualCount(S),
    lambda: cascadeLambda(residualCount(S)),
    logCoord: logCoordinate(S),
    psi: psi(S),
    coneOk: coneCompliant(S),
    tau: t,
  };
}

export function softContract(x, k = 0.5) {
  const m = ((Number(x) % 9) + 9) % 9;
  return FIXED + k * (m - FIXED);
}

/** Build a residual snapshot suitable for status / attestation documents */
export function residualSnapshot({ S = 0, tau = null, roleBlock = null } = {}) {
  const coord = tau != null ? fromTopologicalSaturation(tau) : {
    S,
    n: residualCount(S),
    lambda: cascadeLambda(residualCount(S)),
    logCoord: logCoordinate(S),
    psi: psi(S),
    coneOk: coneCompliant(S),
    tau: null,
  };
  return {
    schema: 'great-scale.residual/v1',
    PHI,
    CONE,
    residualPartition: RESIDUAL_PARTITION,
    dualAtlas: DUAL_ATLAS,
    role: roleBlock != null ? atlasRole(roleBlock) : null,
    roleBlock,
    ...coord,
    laws: [
      'keep_mean',
      'respect_partition',
      'cone_floor',
      'scale_generated_only',
      'agents_as_fixed_points',
      'attestation_dual_of_heat',
    ],
  };
}

export {
  PHI,
  PHI_INV,
  CONE,
  FIXED,
  RESIDUAL_PARTITION,
  DUAL_ATLAS,
};
