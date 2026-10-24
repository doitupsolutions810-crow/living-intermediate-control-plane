/** Great Scale research bridge: keep reflection, contraction, and evidence claims distinct. */
export const FIXED = 4.5;
export const PAIRS = [[1,8],[2,7],[3,6],[4,5]];

/** Canonical involution on R/9Z, with the boundary class 0 ≡ 9. */
export function involution(x) {
  const m = ((x % 9) + 9) % 9;
  return (9 - m) % 9;
}
export function modDist(a, b) {
  const d = Math.abs((((a - b) % 9) + 9) % 9);
  return Math.min(d, 9 - d);
}

/** Reflection through the midpoint; distinct from a convergent dynamical map. */
export function softMap(x) { return 9 - x; }

/** Linear contraction toward FIXED. For |k| < 1, x_n - FIXED = k^n (x_0 - FIXED). */
export function softContract(x, k = 0.5) {
  return FIXED + (x - FIXED) * k;
}

/** Unit-interval heat/tension parabola. */
export function heat(h) { return h * (1 - h); }

/** Great Scale's discrete coordinate for x ∈ [1,8]: H=(x−1)/7. */
export function canonicalHeat(x) {
  const H = (x - 1) / 7;
  return heat(H);
}

export function convergenceSteps(start, eps = 1e-6, max = 5000, k = 0.5) {
  let x = start, n = 0;
  while (Math.abs(x - FIXED) > eps && n < max) { x = softContract(x, k); n++; }
  return { start, steps: n, final: x, converged: Math.abs(x - FIXED) <= eps };
}

export function cycleStability() {
  return PAIRS.map(([a,b]) => {
    const ga = softMap(a), gb = softMap(b);
    return {
      pair: [a,b], gA: ga, gB: gb,
      preserved: Math.abs(ga-b) < 1e-9 && Math.abs(gb-a) < 1e-9,
      drift: Math.abs(ga-b) + Math.abs(gb-a)
    };
  });
}

/** Diagnostic disagreement between two maps; zero at FIXED alone is not evidence for a theory. */
export function stressInvariant(x) {
  const f = involution(x), g = softContract(x);
  return { x, involution: f, soft: g, residual: Math.abs(g-f) };
}

/**
 * Reports model-derived quantities only. A small residual at FIXED is tautological
 * and must not be labelled empirical or scientific support.
 */
export function hypothesisReport(x) {
  const H = (x - 1) / 7;
  const S = heat(H);
  const inv = stressInvariant(x);
  return {
    hypothesis: 'On x ∈ [1,8], use H=(x−1)/7 and S=H(1−H); reflection is x↦9−x; contraction is x↦4.5+k(x−4.5).',
    x, H, S, residual: inv.residual,
    status: 'not-established',
    evidenceBoundary: 'Algebraic/numerical consistency only; no empirical observation or independent replication is supplied by this report.'
  };
}

export function runResearch(k = 0.5) {
  const conv = [1,2,3,4,5,6,7,8].map(s => convergenceSteps(s,1e-6,5000,k));
  const cycles = cycleStability();
  const stress = [1,2,3,4,4.5,5,6,7,8].map(stressInvariant);
  const hyp = hypothesisReport(4.5);
  return { k, convergence:conv, cycles, stress, hypothesis:hyp };
}
export default { FIXED, PAIRS, involution, modDist, softMap, softContract, heat, canonicalHeat, convergenceSteps, cycleStability, stressInvariant, hypothesisReport, runResearch };
