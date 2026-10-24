import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  involution, modDist, heat, convergenceSteps, stressInvariant, hypothesisReport,
  FIXED, PAIRS, softMap, softContract, cycleStability, runResearch
} = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'bridge', 'great-scale-research.mjs')).href);
const { PHI, PHI_INV, CONE, stateAt } =
  await import(pathToFileURL(path.join(__dirname, '..', 'src', 'bridge', 'great-scale.mjs')).href);

test('involution is identity modulo nine, including 0 ≡ 9', () => {
  for (const x of [0,1,2,3,4,4.5,5,6,7,8,9,-9]) {
    assert.ok(modDist(involution(involution(x)), x) < 1e-9, `x=${x}`);
  }
  assert.equal(involution(0), 0);
  assert.equal(involution(9), 0);
});

test('canonical cone is φ⁻²', () => {
  assert.ok(Math.abs(CONE - PHI_INV * PHI_INV) < 1e-12);
  assert.ok(Math.abs(CONE - 0.38196601125) < 1e-10);
  assert.ok(Math.abs(stateAt(0).psi - CONE) < 1e-12);
  assert.ok(PHI > 1.6);
});

test('heat equals tension form', () => {
  assert.equal(heat(0.5), 0.25);
  assert.equal(heat(0), 0);
  assert.equal(heat(1), 0);
});

test('softMap is the reflection involution, not the contraction', () => {
  for (const x of [0,1,2,3,4,4.5,5,6,7,8,9]) {
    assert.ok(modDist(softMap(softMap(x)), x) < 1e-9, `x=${x}`);
    assert.ok(modDist(softMap(x), involution(x)) < 1e-9, `x=${x}`);
  }
  assert.equal(softMap(FIXED), FIXED);
});

test('softContract converges geometrically with the requested contraction ratio', () => {
  for (const s of [1,2,3,4,5,6,7,8]) {
    const r = convergenceSteps(s, 1e-6, 5000, 0.5);
    assert.ok(r.converged, `start ${s} did not converge in ${r.steps} steps`);
    assert.ok(r.steps > 1, 'convergence should not collapse all starts in one step');
    assert.ok(Math.abs(r.final - FIXED) < 1e-5);
    const once = softContract(s, 0.5);
    assert.ok(Math.abs((once - FIXED) - 0.5 * (s - FIXED)) < 1e-12);
  }
});

test('two-cycles preserved by the reflection map', () => {
  for (const [a,b] of PAIRS) {
    assert.equal(softMap(a), b);
    assert.equal(softMap(b), a);
    assert.equal(involution(a), b);
    assert.equal(involution(b), a);
  }
  assert.ok(cycleStability().every(c => c.preserved && c.drift < 1e-9));
});

test('stress residual compares contraction with involution and vanishes at fixed point', () => {
  assert.ok(stressInvariant(4.5).residual < 1e-9);
  assert.ok(stressInvariant(2).residual > 0.5);
});

test('hypothesis report at 4.5 supports', () => {
  const h = hypothesisReport(4.5);
  assert.equal(h.support, 'supports');
  assert.ok(h.S <= 0.25);
});

test('runResearch reports convergent trajectories and preserved cycles', () => {
  const r = runResearch(0.5);
  assert.ok(r.convergence.every(c => c.converged));
  assert.ok(r.cycles.every(c => c.preserved));
});
