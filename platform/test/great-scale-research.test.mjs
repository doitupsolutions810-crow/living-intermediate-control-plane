import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { involution, softMap, heat, convergenceSteps, cycleStability, stressInvariant, hypothesisReport, FIXED, PAIRS } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'bridge', 'great-scale-research.mjs')).href);

test('involution is an involution: f(f(x)) = x', () => {
  for (const x of [0,1,2,3,4,4.5,5,6,7,8,9]) assert.equal(involution(involution(x)), x);
});

test('heat equals tension form', () => {
  assert.equal(heat(0.5), 0.25);
  assert.equal(heat(0), 0);
  assert.equal(heat(1), 0);
});

test('soft map converges to fixed point 4.5', () => {
  for (const s of [1,2,3,4,5,6,7,8]) {
    const r = convergenceSteps(s, 1e-6, 5000, 0.5);
    assert.ok(r.converged, `start ${s} did not converge in ${r.steps} steps`);
    assert.ok(Math.abs(r.final - FIXED) < 1e-5);
  }
});

test('two-cycles preserved by involution', () => {
  for (const [a,b] of PAIRS) {
    assert.equal(involution(a), b);
    assert.equal(involution(b), a);
  }
});

test('stress invariant residual is zero at both circle fixed points', () => {
  assert.ok(stressInvariant(0).residual < 1e-9);
  assert.ok(stressInvariant(4.5).residual < 1e-9);
  assert.ok(stressInvariant(2).residual > 0.5);
});

test('hypothesis report at 4.5 supports', () => {
  const h = hypothesisReport(4.5);
  assert.equal(h.support, 'supports');
  assert.ok(h.S <= 0.25);
});
