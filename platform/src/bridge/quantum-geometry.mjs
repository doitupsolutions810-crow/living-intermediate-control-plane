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
  const detG = g11 * g22 - g12 * g12;
  if (!(detG > 0)) throw new RangeError('The two-direction metric must be positive and nondegenerate (detG > 0).');
  const rawChi = Math.abs(curvature) / (2 * Math.sqrt(detG));
  if (rawChi > 1 + tolerance) throw new RangeError('QGT positivity violated: |F_12| > 2 sqrt(detG).');
  const chi = Math.min(1, rawChi);
  const detQ = Math.max(0, detG - curvature * curvature / 4);
  const residual = Math.max(0, 1 - chi * chi);
  const h = (1 + chi) / 2;
  const S = heat(h);
  const n = 8 - 4 * S;
  const metricMean = (g11 + g22) / 2;
  const metricSpread = Math.sqrt(((g11 - g22) / 2) ** 2 + g12 ** 2);
  const metricEigenvalues = [metricMean - metricSpread, metricMean + metricSpread];
  return {
    schema: 'great-scale.quantum-geometry/v1', detG, detQ,
    signedCurvature: curvature, metricEigenvalues,
    metricAnisotropy: metricEigenvalues[0] / metricEigenvalues[1],
    curvatureFraction: chi, normalizedResidual: residual, h, S, n,
    lambda: Math.pow(PHI, -n), psi: CONE + S, cone: CONE
  };
}
export default { quantumGeometryToScale };
