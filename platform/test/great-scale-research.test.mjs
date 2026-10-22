import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { involution, softMap, softContract, heat, convergenceSteps, cycleStability, stressInvariant, hypothesisReport, FIXED, PAIRS } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'bridge', 'great-scale-research.mjs')).href);

test('involution is an involution modulo 9', () => {
  const modDistance = (a, b) => {
    const difference = ((a - b) % 9 + 9) % 9;
    return Math.min(difference, 9 - difference);
  };
  for (const x of [-0.5,0,1,2,3,4,4.5,5,6,7,8,9,10.25]) {
    assert.ok(involution(x) >= 0 && involution(x) < 9);
    assert.ok(modDistance(involution(involution(x)), x) < 1e-9);
  }
});

test('heat is symmetric and bounded by one quarter', () => {
  for (const x of [0,0.1,0.25,0.5,0.75,0.9,1]) {
    assert.ok(Math.abs(heat(x) - heat(1 - x)) < 1e-12);
    assert.ok(Math.abs(heat(x) - (0.25 - (x - 0.5) ** 2)) < 1e-12);
    assert.ok(heat(x) <= 0.25);
  }
});

test('heat equals tension form', () => {
  assert.equal(heat(0.5), 0.25);
  assert.equal(heat(0), 0);
  assert.equal(heat(1), 0);
});

test('involution and soft contraction have distinct dynamics', () => {
  assert.equal(softMap(1), 8);
  assert.equal(softContract(1), 2.75);
  for (const s of [1,2,3,4,5,6,7,8]) {
    const r = convergenceSteps(s, 1e-6, 5000, 0.5);
    assert.ok(r.converged, `start ${s} did not converge in ${r.steps} steps`);
    assert.ok(Math.abs(r.final - FIXED) < 1e-5);
    assert.ok(r.steps > 1, 'convergence is iterative, not a one-step projection');
  }
});

test('two-cycles preserved by involution', () => {
  for (const [a,b] of PAIRS) {
    assert.equal(involution(a), b);
    assert.equal(involution(b), a);
  }
  assert.ok(cycleStability().every(cycle => cycle.preserved));
});

test('stress invariant residual is zero at fixed point', () => {
  const s = stressInvariant(4.5);
  assert.ok(s.residual < 1e-9);
});

test('hypothesis report qualifies fixed-point agreement as local only', () => {
  const h = hypothesisReport(4.5);
  assert.equal(h.support, 'fixed-point coincidence only');
  assert.equal(h.evidenceStatus, 'mathematical/software hypothesis; not empirical evidence');
  assert.ok(h.S <= 0.25);
  assert.equal(hypothesisReport(1).support, 'tensions');
});
