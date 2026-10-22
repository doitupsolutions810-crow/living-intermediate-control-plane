import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { involution, canonicalizeCircleCoordinate, softMap, heat, convergenceSteps, cycleStability, stressInvariant, hypothesisReport, FIXED, PAIRS } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'bridge', 'great-scale-research.mjs')).href);

test('involution is an involution modulo nine and returns canonical representatives', () => {
  for (const x of [0,1,2,3,4,4.5,5,6,7,8,9,-1,19]) {
    const y = involution(involution(x));
    assert.ok(Math.abs(canonicalizeCircleCoordinate(y) - canonicalizeCircleCoordinate(x)) < 1e-12);
    assert.ok(involution(x) >= 0 && involution(x) < 9);
  }
  assert.equal(involution(9), 0);
  assert.equal(involution(-1), 1);
  assert.throws(() => involution(Number.NaN), /finite/);
});

test('heat equals tension form and rejects values outside its domain', () => {
  assert.equal(heat(0.5), 0.25);
  assert.equal(heat(0), 0);
  assert.equal(heat(1), 0);
  assert.throws(() => heat(Number.NaN), /finite/);
  assert.throws(() => heat(-0.1), /\[0, 1\]/);
  assert.throws(() => heat(1.1), /\[0, 1\]/);
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

test('hypothesis heat is periodic and bounded for circle representatives', () => {
  for (const x of [-19, -1, 0, 4.5, 9, 19, 28]) {
    const report = hypothesisReport(x);
    assert.ok(report.S >= 0 && report.S <= 0.25, 'heat out of bounds at x=' + x + ': ' + report.S);
  }
  assert.ok(Math.abs(hypothesisReport(-1).S - hypothesisReport(8).S) < 1e-12);
  assert.ok(Math.abs(hypothesisReport(19).S - hypothesisReport(1).S) < 1e-12);
});
