/** Great Scale research bridge: keep reflection and contraction as distinct maps. */
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

/** Reflection through the midpoint. This preserves the involution's two-cycles. */
export function softMap(x) { return 9 - x; }

/** Contract toward FIXED. For |k| < 1, x_n - FIXED = k^n (x_0 - FIXED). */
export function softContract(x, k = 0.5) {
  return FIXED + (x - FIXED) * k;
}

export function heat(h) { return h * (1 - h); }

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

export function stressInvariant(x) {
  const f = involution(x), g = softContract(x);
  return { x, involution: f, soft: g, residual: Math.abs(g-f) };
}

export function hypothesisReport(x) {
  const S = heat(x/9);
  const inv = stressInvariant(x);
  return {
    hypothesis: 'S(h)=h(1-h) ≡ T(B)=B(1-B); f(x)=(9-(x mod 9)) mod 9; fixed point 4.5; two-cycles (1,8)(2,7)(3,6)(4,5); cone floor; phi zero-mode; stress = moment of now computationally; recursive observation: geometry generates the scale that observes it. No certainty.',
    x, S, residual: inv.residual,
    support: inv.residual < 0.5 ? 'supports' : 'tensions'
  };
}

export function runResearch(k = 0.5) {
  const conv = [1,2,3,4,5,6,7,8].map(s => convergenceSteps(s,1e-6,5000,k));
  const cycles = cycleStability();
  const stress = [0,1,2,3,4,4.5,5,6,7,8,9].map(stressInvariant);
  const hyp = hypothesisReport(4.5);
  return { k, convergence:conv, cycles, stress, hypothesis:hyp };
}
export default { FIXED, PAIRS, involution, modDist, softMap, softContract, heat, convergenceSteps, cycleStability, stressInvariant, hypothesisReport, runResearch };
