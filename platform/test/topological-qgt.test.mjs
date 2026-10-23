import test from 'node:test';
import assert from 'node:assert/strict';
import { quantumGeometryToScale } from '../src/bridge/quantum-geometry.mjs';
import { qiWuZhangChernNumber, qiWuZhangLocalQGT } from '../src/bridge/topological-qgt.mjs';

function close(a, b, tolerance = 1e-8) { assert.ok(Math.abs(a - b) <= tolerance, a + ' != ' + b); }

test('QWZ lower band has Chern number -1 for m=-1', () => close(qiWuZhangChernNumber(-1), -1));
test('QWZ lower band has Chern number +1 for m=+1', () => close(qiWuZhangChernNumber(1), 1));
test('QWZ trivial phase m=3 has Chern number zero', () => close(qiWuZhangChernNumber(3), 0));
test('gap-closing model at m=0 is rejected', () => assert.throws(() => qiWuZhangChernNumber(0), /Band gap closes/));
test('local QGT saturates the positivity bound in the m=-1 phase', () => {
  const r = quantumGeometryToScale(qiWuZhangLocalQGT(.37, .81, -1));
  close(r.curvatureFraction, 1, 1e-9); close(r.S, 0, 1e-9); close(r.psi, .3819660112501051, 1e-9);
});
test('opposite Chern phases share the same local Great Scale floor', () => {
  const a = quantumGeometryToScale(qiWuZhangLocalQGT(.37, .81, -1));
  const b = quantumGeometryToScale(qiWuZhangLocalQGT(.37, .81, 1));
  close(a.S, 0, 1e-9); close(b.S, 0, 1e-9); close(a.psi, b.psi, 1e-9);
  close(qiWuZhangChernNumber(-1), -qiWuZhangChernNumber(1), 1e-8);
});
test('Chern result is stable between 20x20 and 40x40 grids in gapped phases', () => {
  close(qiWuZhangChernNumber(-1, 20), qiWuZhangChernNumber(-1, 40));
  close(qiWuZhangChernNumber(1, 20), qiWuZhangChernNumber(1, 40));
});
test('invalid grid sizes and nonfinite masses are rejected', () => {
  assert.throws(() => qiWuZhangChernNumber(1, 3), /gridSize/);
  assert.throws(() => qiWuZhangChernNumber(Number.NaN), /finite/);
});
