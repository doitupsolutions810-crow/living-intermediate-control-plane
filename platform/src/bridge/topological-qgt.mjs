import { CONE, heat } from './great-scale.mjs';
const TWO_PI = 2 * Math.PI;
const EPS = 1e-12;
const c = (re, im = 0) => [re, im];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const conj = a => [a[0], -a[1]];
const absC = a => Math.hypot(a[0], a[1]);

export function qiWuZhangLowerBandState(kx, ky, m) {
  const dx = Math.sin(kx), dy = Math.sin(ky), dz = m + Math.cos(kx) + Math.cos(ky);
  const energy = Math.hypot(dx, dy, dz);
  if (energy < EPS) throw new RangeError('Band gap closes at (' + kx + ', ' + ky + ') for m=' + m + '.');
  let a, b;
  if (energy + dz > EPS) { a = c(-dx, dy); b = c(energy + dz); }
  else { a = c(energy - dz); b = c(-dx, -dy); }
  const norm = Math.hypot(absC(a), absC(b));
  return [c(a[0] / norm, a[1] / norm), c(b[0] / norm, b[1] / norm)];
}
function overlap(u, v) { return add(mul(conj(u[0]), v[0]), mul(conj(u[1]), v[1])); }
function phase(z) {
  const magnitude = absC(z);
  if (magnitude < EPS) throw new RangeError('Neighboring occupied states have vanishing overlap; refine or inspect the grid.');
  return [z[0] / magnitude, z[1] / magnitude];
}

/** Discrete Chern number using FHS plaquette phases; orientation fixes the reported sign. */
export function qiWuZhangChernNumber(m, gridSize = 40) {
  if (!Number.isFinite(m)) throw new TypeError('Mass parameter m must be finite.');
  if (Math.abs(m + 2) < EPS || Math.abs(m) < EPS || Math.abs(m - 2) < EPS) {
    throw new RangeError('Band gap closes at a topological phase boundary for m=' + m + '.');
  }
  if (!Number.isInteger(gridSize) || gridSize < 4) throw new RangeError('gridSize must be an integer >= 4.');
  const states = Array.from({ length: gridSize }, (_, i) =>
    Array.from({ length: gridSize }, (_, j) =>
      qiWuZhangLowerBandState(TWO_PI * i / gridSize, TWO_PI * j / gridSize, m)));
  const ux = Array.from({ length: gridSize }, () => Array(gridSize));
  const uy = Array.from({ length: gridSize }, () => Array(gridSize));
  for (let i = 0; i < gridSize; i++) for (let j = 0; j < gridSize; j++) {
    ux[i][j] = phase(overlap(states[i][j], states[(i + 1) % gridSize][j]));
    uy[i][j] = phase(overlap(states[i][j], states[i][(j + 1) % gridSize]));
  }
  let total = 0;
  for (let i = 0; i < gridSize; i++) for (let j = 0; j < gridSize; j++) {
    const w = mul(mul(mul(ux[i][j], uy[(i + 1) % gridSize][j]), conj(ux[i][(j + 1) % gridSize])), conj(uy[i][j]));
    total += Math.atan2(w[1], w[0]);
  }
  return total / TWO_PI;
}

/** Analytic QGT of the Bloch vector n=d/|d| at a regular point. */
export function qiWuZhangLocalQGT(kx, ky, m) {
  const d = [Math.sin(kx), Math.sin(ky), m + Math.cos(kx) + Math.cos(ky)];
  const energy = Math.hypot(...d);
  if (energy < EPS) throw new RangeError('Band gap closes at (' + kx + ', ' + ky + ') for m=' + m + '.');
  const n = d.map(v => v / energy);
  const dx = [Math.cos(kx), 0, -Math.sin(kx)], dy = [0, Math.cos(ky), -Math.sin(ky)];
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const project = v => v.map((x, i) => (x - n[i] * dot(n, v)) / energy);
  const nx = project(dx), ny = project(dy);
  return { g11: dot(nx, nx) / 4, g12: dot(nx, ny) / 4, g22: dot(ny, ny) / 4,
    curvature: -dot(n, cross(nx, ny)) / 2, gap: 2 * energy };
}

/**
 * Whole-Brillouin-zone diagnostic. Curvature is oriented to match the
 * occupied lower-band FHS Chern number. The normalized metric area obeys A/pi >= |C|.
 */
/**
 * Midpoint-sampled whole-Brillouin-zone QGT integrals at a given grid.
 * The signed curvature and unsigned metric area are separate quadratures.
 */
function qiWuZhangLocalIntegrals(m, gridSize) {
  const dk = TWO_PI / gridSize;
  let signedCurvature = 0, absoluteCurvature = 0, metricAreaDensity = 0;
  for (let i = 0; i < gridSize; i++) for (let j = 0; j < gridSize; j++) {
    const q = qiWuZhangLocalQGT(TWO_PI * i / gridSize, TWO_PI * j / gridSize, m);
    signedCurvature += q.curvature;
    absoluteCurvature += Math.abs(q.curvature);
    metricAreaDensity += Math.sqrt(Math.max(0, q.g11 * q.g22 - q.g12 * q.g12));
  }
  const cellArea = dk * dk;
  return {
    integratedCurvature: signedCurvature * cellArea / TWO_PI,
    absoluteCurvatureBudget: absoluteCurvature * cellArea / TWO_PI,
    metricAreaBudget: metricAreaDensity * cellArea / Math.PI
  };
}

/**
 * Whole-Brillouin-zone diagnostic plus a one-level refinement check.
 * quadratureConverged is a resolution heuristic, not a rigorous error bound.
 * A flagged result must not be interpreted as a converged geometric-area estimate.
 */
export function qiWuZhangGlobalGeometry(m, gridSize = 80) {
  if (!Number.isFinite(m)) throw new TypeError('Mass parameter m must be finite.');
  if (Math.abs(m + 2) < EPS || Math.abs(m) < EPS || Math.abs(m - 2) < EPS) {
    throw new RangeError('Band gap closes at a topological phase boundary for m=' + m + '.');
  }
  if (!Number.isInteger(gridSize) || gridSize < 4) throw new RangeError('gridSize must be an integer >= 4.');

  const chernNumber = Math.round(qiWuZhangChernNumber(m, gridSize));
  const base = qiWuZhangLocalIntegrals(m, gridSize);
  const refined = qiWuZhangLocalIntegrals(m, gridSize * 2);
  const curvatureQuadratureError = Math.abs(refined.integratedCurvature - base.integratedCurvature);
  const metricAreaQuadratureError = Math.abs(refined.metricAreaBudget - base.metricAreaBudget);
  const quadratureTolerance = 1e-3 * Math.max(1, Math.abs(refined.metricAreaBudget));
  const quadratureConverged =
    curvatureQuadratureError <= quadratureTolerance &&
    metricAreaQuadratureError <= quadratureTolerance;

  const topologicalFloor = Math.abs(chernNumber);
  const metricAreaExcess = base.metricAreaBudget - topologicalFloor;
  const topologicalSaturation = base.metricAreaBudget > EPS
    ? Math.max(0, Math.min(1, topologicalFloor / base.metricAreaBudget)) : 0;
  const hTopological = (1 + topologicalSaturation) / 2;
  const STopological = heat(hTopological);
  const psiTopological = CONE + STopological;
  return {
    chernNumber,
    integratedCurvature: base.integratedCurvature,
    absoluteCurvatureBudget: base.absoluteCurvatureBudget,
    metricAreaBudget: base.metricAreaBudget,
    topologicalFloor, metricAreaExcess, topologicalSaturation,
    hTopological, STopological, psiTopological,
    refinedIntegratedCurvature: refined.integratedCurvature,
    refinedAbsoluteCurvatureBudget: refined.absoluteCurvatureBudget,
    refinedMetricAreaBudget: refined.metricAreaBudget,
    curvatureQuadratureError, metricAreaQuadratureError,
    quadratureTolerance, quadratureConverged
  };
}
