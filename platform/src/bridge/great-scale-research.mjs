export const FIXED = 4.5;
export const PAIRS = [[1,8],[2,7],[3,6],[4,5]];

export function canonicalizeCircleCoordinate(x) {
  const value = Number(x);
  if (!Number.isFinite(value)) throw new TypeError('circle coordinate must be finite');
  return ((value % 9) + 9) % 9;
}

export function involution(x) {
  const m = canonicalizeCircleCoordinate(x);
  return (9 - m) % 9;
}

// Circle symmetry and contraction are different operations.
// Keep softMap aligned with great-scale/public/scale.cjs: reflection modulo 9.
export function softMap(x) {
  return involution(x);
}

// Linear contraction toward FIXED, aligned with great-scale softContract.
// k=0 is immediate collapse; k=0.5 halves the distance each iteration.
export function softContract(x, k = 0.5) {
  const value = Number(x);
  const factor = Number(k);
  if (!Number.isFinite(value) || !Number.isFinite(factor)) {
    throw new TypeError('soft contraction input and factor must be finite');
  }
  return FIXED + (value - FIXED) * factor;
}

export function heat(h) {
  const value = Number(h);
  if (!Number.isFinite(value)) throw new TypeError('heat input h must be finite');
  if (value < 0 || value > 1) throw new RangeError('heat input h must be in [0, 1]');
  return value * (1 - value);
}

export function convergenceSteps(start, eps = 1e-6, max = 5000, k = 0.5) {
  let x = Number(start), n = 0;
  if (!Number.isFinite(x) || !Number.isFinite(eps) || eps < 0 || !Number.isFinite(max) || max < 0) {
    throw new TypeError('start, eps, and max must be finite; eps and max must be nonnegative');
  }
  while (Math.abs(x - FIXED) > eps && n < max) {
    x = softContract(x, k);
    n++;
  }
  return { start, steps: n, final: x, converged: Math.abs(x - FIXED) <= eps };
}

export function cycleStability() {
  const out = [];
  for (const [a, b] of PAIRS) {
    const ga = softMap(a), gb = softMap(b);
    out.push({
      pair: [a, b], gA: ga, gB: gb,
      preserved: Math.abs(ga - b) < 1e-9 && Math.abs(gb - a) < 1e-9,
      drift: Math.abs(ga - b) + Math.abs(gb - a)
    });
  }
  return out;
}

export function stressInvariant(x) {
  const canonical = canonicalizeCircleCoordinate(x);
  const f = involution(canonical), g = softContract(canonical);
  const d = Math.abs(((canonical - f) % 9 + 9) % 9);
  const residual = Math.min(d, 9 - d);
  return { x, involution: f, soft: g, residual };
}

export function hypothesisReport(x) {
  const canonical = canonicalizeCircleCoordinate(x);
  const S = heat(canonical / 9);
  const inv = stressInvariant(canonical);
  return {
    hypothesis: 'S(h)=h(1-h) ≡ T(B)=B(1-B); f(x)=9-(x mod 9); fixed point 4.5; two-cycles (1,8)(2,7)(3,6)(4,5); cone floor; phi zero-mode; recursive observation: geometry generates the scale that observes it. No certainty.',
    x, S, residual: inv.residual,
    support: inv.residual < 0.5 ? 'supports' : 'tensions',
    supportScope: 'reflection-residual-only',
    claimsAssessed: ['distance from the supplied coordinate to its circle reflection'],
    claimsNotAssessed: [
      'heat/tension identity across independent subsystems',
      'cone-floor and phi-zero-mode claims',
      'all listed two-cycle properties',
      'topological QGT and Chern-number claims'
    ]
  };
}

export function runResearch(k = 0.5) {
  const conv = [1,2,3,4,5,6,7,8].map(s => convergenceSteps(s, 1e-6, 5000, k));
  const cycles = cycleStability();
  const stress = [0,1,2,3,4,4.5,5,6,7,8,9].map(stressInvariant);
  const hyp = hypothesisReport(4.5);
  return { k, convergence: conv, cycles, stress, hypothesis: hyp };
}

export default {
  FIXED, PAIRS, canonicalizeCircleCoordinate, involution,
  softMap, softContract, heat, convergenceSteps, cycleStability,
  stressInvariant, hypothesisReport, runResearch
};
