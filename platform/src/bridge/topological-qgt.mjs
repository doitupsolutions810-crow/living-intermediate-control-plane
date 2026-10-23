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
 * Uniform-grid whole-Brillouin-zone QGT integrals.
 * offset=0 samples grid vertices; offset=0.5 samples cell centers.
 */
function qiWuZhangLocalIntegrals(m, gridSize, offset = 0.5) {
  const dk = TWO_PI / gridSize;
  let signedCurvature = 0, absoluteCurvature = 0, metricAreaDensity = 0;
  let positiveCurvature = 0, negativeCurvature = 0;
  for (let i = 0; i < gridSize; i++) for (let j = 0; j < gridSize; j++) {
    const kx = TWO_PI * (i + offset) / gridSize;
    const ky = TWO_PI * (j + offset) / gridSize;
    const q = qiWuZhangLocalQGT(kx, ky, m);
    signedCurvature += q.curvature;
    absoluteCurvature += Math.abs(q.curvature);
    if (q.curvature >= 0) positiveCurvature += q.curvature;
    else negativeCurvature += -q.curvature;
    metricAreaDensity += Math.sqrt(Math.max(0, q.g11 * q.g22 - q.g12 * q.g12));
  }
  const cellArea = dk * dk;
  return {
    integratedCurvature: signedCurvature * cellArea / TWO_PI,
    absoluteCurvatureBudget: absoluteCurvature * cellArea / TWO_PI,
    positiveCurvatureBudget: positiveCurvature * cellArea / TWO_PI,
    negativeCurvatureBudget: negativeCurvature * cellArea / TWO_PI,
    metricAreaBudget: metricAreaDensity * cellArea / Math.PI
  };
}

/**
 * Bounded refinement with grid-origin sensitivity checks.
 * The convergence flag is a numerical heuristic, not a rigorous error bound.
 */
export function qiWuZhangGlobalGeometry(m, gridSize = 80, maxRefinements = 3) {
  if (!Number.isFinite(m)) throw new TypeError('Mass parameter m must be finite.');
  if (Math.abs(m + 2) < EPS || Math.abs(m) < EPS || Math.abs(m - 2) < EPS) {
    throw new RangeError('Band gap closes at a topological phase boundary for m=' + m + '.');
  }
  if (!Number.isInteger(gridSize) || gridSize < 4) throw new RangeError('gridSize must be an integer >= 4.');
  if (!Number.isInteger(maxRefinements) || maxRefinements < 1 || maxRefinements > 5) {
    throw new RangeError('maxRefinements must be an integer between 1 and 5.');
  }

  const rawChernNumber = qiWuZhangChernNumber(m, gridSize);
  const chernNumber = Math.round(rawChernNumber);
  const chernIntegerResidual = Math.abs(rawChernNumber - chernNumber);
  const initial = qiWuZhangLocalIntegrals(m, gridSize, 0.5);

  let currentGridSize = gridSize;
  let currentMidpoint = initial;
  let currentVertex = qiWuZhangLocalIntegrals(m, currentGridSize, 0);
  let curvatureQuadratureError = Infinity;
  let metricAreaQuadratureError = Infinity;
  let gridAlignmentCurvatureDiscrepancy = Math.abs(currentVertex.integratedCurvature - currentMidpoint.integratedCurvature);
  let gridAlignmentAreaDiscrepancy = Math.abs(currentVertex.metricAreaBudget - currentMidpoint.metricAreaBudget);
  let quadratureTolerance = 1e-3 * Math.max(1, Math.abs(currentMidpoint.metricAreaBudget));
  let quadratureConverged = false;
  let refinementCount = 0;

  for (let level = 0; level < maxRefinements; level++) {
    const nextGridSize = currentGridSize * 2;
    const nextMidpoint = qiWuZhangLocalIntegrals(m, nextGridSize, 0.5);
    const nextVertex = qiWuZhangLocalIntegrals(m, nextGridSize, 0);
    curvatureQuadratureError = Math.abs(nextMidpoint.integratedCurvature - currentMidpoint.integratedCurvature);
    metricAreaQuadratureError = Math.abs(nextMidpoint.metricAreaBudget - currentMidpoint.metricAreaBudget);
    gridAlignmentCurvatureDiscrepancy = Math.abs(nextVertex.integratedCurvature - nextMidpoint.integratedCurvature);
    gridAlignmentAreaDiscrepancy = Math.abs(nextVertex.metricAreaBudget - nextMidpoint.metricAreaBudget);
    quadratureTolerance = 1e-3 * Math.max(1, Math.abs(nextMidpoint.metricAreaBudget));
    currentGridSize = nextGridSize;
    currentMidpoint = nextMidpoint;
    refinementCount++;
    quadratureConverged =
      curvatureQuadratureError <= quadratureTolerance &&
      metricAreaQuadratureError <= quadratureTolerance &&
      gridAlignmentCurvatureDiscrepancy <= quadratureTolerance &&
      gridAlignmentAreaDiscrepancy <= quadratureTolerance;
    if (quadratureConverged) break;
  }

  const topologicalFloor = Math.abs(chernNumber);
  const metricAreaExcess = currentMidpoint.metricAreaBudget - topologicalFloor;
  const topologicalSaturationRaw = currentMidpoint.metricAreaBudget > EPS
    ? topologicalFloor / currentMidpoint.metricAreaBudget : 0;
  const topologicalSaturation = Math.max(0, Math.min(1, topologicalSaturationRaw));
  const topologicalMappingValid = quadratureConverged &&
    chernIntegerResidual <= 1e-6 &&
    metricAreaExcess >= -quadratureTolerance;
  const hTopological = (1 + topologicalSaturation) / 2;
  const STopological = heat(hTopological);
  const psiTopological = CONE + STopological;

  return {
    chernNumber, rawChernNumber, chernIntegerResidual,
    integratedCurvature: currentMidpoint.integratedCurvature,
    absoluteCurvatureBudget: currentMidpoint.absoluteCurvatureBudget,
    positiveCurvatureBudget: currentMidpoint.positiveCurvatureBudget,
    negativeCurvatureBudget: currentMidpoint.negativeCurvatureBudget,
    curvatureCancellationBudget: Math.max(0, currentMidpoint.absoluteCurvatureBudget - Math.abs(currentMidpoint.integratedCurvature)),
    metricAreaBudget: currentMidpoint.metricAreaBudget,
    topologicalFloor, metricAreaExcess,
    topologicalSaturationRaw, topologicalSaturation,
    hTopological, STopological, psiTopological,
    certifiedPsiTopological: topologicalMappingValid ? psiTopological : null,
    topologicalMappingValid,
    baseMetricAreaBudget: initial.metricAreaBudget,
    refinedIntegratedCurvature: currentMidpoint.integratedCurvature,
    refinedAbsoluteCurvatureBudget: currentMidpoint.absoluteCurvatureBudget,
    refinedMetricAreaBudget: currentMidpoint.metricAreaBudget,
    curvatureQuadratureError, metricAreaQuadratureError,
    gridAlignmentCurvatureDiscrepancy, gridAlignmentAreaDiscrepancy,
    quadratureTolerance, quadratureConverged,
    refinementCount, refinedGridSize: currentGridSize
  };
}
