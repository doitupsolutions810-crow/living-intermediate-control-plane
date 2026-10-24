/**
 * Quantum-geometric residual → Great Scale.
 * Convention: curvature F12 = 2 Im(Q12).
 * Additive: does not mutate the phase-driven scale state.
 */
import { PHI, CONE, heat } from './great-scale.mjs';
export function quantumGeometryToScale({ g11, g12, g22, curvature }, tolerance = 1e-10) {
  const values = [g11, g12, g22, curvature];
  if (!values.every(Number.isFinite)) throw new TypeError('Metric entries and curvature must be finite numbers.');
  if (!(tolerance >= 0) || !Number.isFinite(tolerance)) throw new TypeError('Tolerance must be finite and nonnegative.');
  if (!(g11 > 0) || !(g22 > 0)) throw new RangeError('Metric diagonal entries must be positive.');
  // Normalize the metric before determinant arithmetic. Under a common positive
  // rescaling (g,F) -> (s g,s F), chi is invariant, but raw determinants may
  // underflow/overflow even when normalized geometry remains representable.
  const metricScale = Math.max(g11, Math.abs(g12), g22);
  const a11 = g11 / metricScale, a12 = g12 / metricScale, a22 = g22 / metricScale;
  const detScaled = a11 * a22 - a12 * a12;
  if (!(detScaled > 0) || !Number.isFinite(detScaled)) throw new RangeError('The two-direction metric must be positive and nondegenerate (scaled detG > 0).');
  const scaledCurvature = curvature / metricScale;
  const rawChi = Math.abs(scaledCurvature) / (2 * Math.sqrt(detScaled));
  if (!Number.isFinite(rawChi) || rawChi > 1 + tolerance) throw new RangeError('QGT positivity violated: |F_12| > 2 sqrt(detG).');
  // Preserve evidence of tolerated clipping: otherwise a slightly invalid input
  // is indistinguishable from exact geometric saturation in downstream scalars.
  const positivityOvershoot = Math.max(0, rawChi - 1);
  const saturationProjected = rawChi > 1;
  const chi = Math.min(1, rawChi);
  const detQScaled = Math.max(0, detScaled - (scaledCurvature * scaledCurvature) / 4);
  const detG = detScaled * metricScale * metricScale;
  const detQ = detQScaled * metricScale * metricScale;
  const residual = Math.max(0, 1 - chi * chi);
  const h = (1 + chi) / 2;
  const S = heat(h);
  const n = 8 - 4 * S;
  // Compute eigenvalues in normalized coordinates first. Raw sums and squares
  // can overflow even when the rescaled eigenvalues themselves are representable.
  const metricMeanScaled = (a11 + a22) / 2;
  const metricSpreadScaled = Math.hypot((a11 - a22) / 2, a12);
  const metricEigenvalues = [
    (metricMeanScaled - metricSpreadScaled) * metricScale,
    (metricMeanScaled + metricSpreadScaled) * metricScale
  ];
  return {
    schema: 'great-scale.quantum-geometry/v1', detG, detQ,
    signedCurvature: curvature, metricEigenvalues,
    metricAnisotropy: metricEigenvalues[0] / metricEigenvalues[1],
    curvatureFraction: chi, rawCurvatureFraction: rawChi, positivityOvershoot, saturationProjected,
    normalizedResidual: residual, h, S, n,
    lambda: Math.pow(PHI, -n), psi: CONE + S, cone: CONE
  };
}
export default { quantumGeometryToScale };
