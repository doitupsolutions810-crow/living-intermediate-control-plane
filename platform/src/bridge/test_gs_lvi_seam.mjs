import { softMap, involution, modDist, stressInvariant, hypothesisReport, FIXED, PAIRS } from './great-scale-research.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('PASS', name); }
  else { failed++; console.log('FAIL', name); }
}

// GS-LVI seam: quotient fiber constancy
check('C(0) === C(9) on the circle', Math.abs(softMap(0) - softMap(9)) < 1e-9);
check('C(0+9) === C(0)', Math.abs(softMap(9) - softMap(0)) < 1e-9);
check('C(4.5) is the fixed point', Math.abs(softMap(4.5) - FIXED) < 1e-9);
check('quotient distance at seam is 0, not 4.5', Math.abs(modDist(softMap(0), softMap(9))) < 1e-9);

// fiber witness in hypothesisReport
const hyp = hypothesisReport(0);
check('fiber.C0 === fiber.C9', Math.abs(hyp.fiber.C0 - hyp.fiber.C9) < 1e-9);
check('fiber.quotientDist === 0', Math.abs(hyp.fiber.quotientDist) < 1e-9);

// stress invariant representation-invariant
check('stress(2) === stress(11)', Math.abs(stressInvariant(2).residual - stressInvariant(11).residual) < 1e-9);

// involution preserved
for (const x of [0,1,2,3,4,4.5,5,6,7,8,9]) {
  check(`involution involution involution(${x}) = ${x}`, Math.abs(involution(involution(x)) - x) < 1e-9);
}

// two-cycles approximately preserved under contraction (not collapsed)
for (const [a,b] of PAIRS) {
  const ga = softMap(a), gb = softMap(b);
  check(`cycle (${a},${b}) not collapsed: drift < 1`, Math.abs(ga-b)+Math.abs(gb-a) < 1);
}

// cosine collapse must NOT return
check('softMap is not the constant 4.5', Math.abs(softMap(0) - 4.5) > 1e-9 || Math.abs(softMap(2) - 4.5) > 1e-9);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
