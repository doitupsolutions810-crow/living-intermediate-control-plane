import test from 'node:test';
import assert from 'node:assert/strict';
import { quantumGeometryToScale } from '../src/bridge/quantum-geometry.mjs';
import { CONE, heat } from '../src/bridge/great-scale.mjs';

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test('zero curvature maps to maximum geometric heat', () => {
  const r = quantumGeometryToScale({ g11: 1, g12: 0, g22: 1, curvature: 0 });
  close(r.curvatureFraction, 0);
  close(r.h, 0.5);
  close(r.S, 0.25);
  close(r.S, heat(r.h));
  close(r.normalizedResidual, 1);
  close(r.psi, CONE + 0.25);
});

test('saturation maps to zero heat and canonical cone floor', () => {
  const r = quantumGeometryToScale({ g11: 1, g12: 0, g22: 1, curvature: 2 });
  close(r.curvatureFraction, 1);
  close(r.h, 1);
  close(r.S, 0);
  close(r.normalizedResidual, 0);
  close(r.detQ, 0);
  close(r.psi, CONE);
  close(r.cone, 0.38196601125, 1e-10);
});

test('intermediate curvature exactly encodes normalized QGT residual', () => {
  const r = quantumGeometryToScale({ g11: 1, g12: 0, g22: 1, curvature: 1 });
  close(r.detQ, 0.75);
  close(r.normalizedResidual, 0.75);
  close(r.S, 0.1875);
  close(r.S, r.normalizedResidual / 4);
});

test('mapping is invariant under common positive metric-curvature scaling', () => {
  const a = quantumGeometryToScale({ g11: 1, g12: 0, g22: 1, curvature: 1 });
  const b = quantumGeometryToScale({ g11: 4, g12: 0, g22: 4, curvature: 4 });
  close(a.curvatureFraction, b.curvatureFraction);
  close(a.S, b.S);
});

test('rejects curvature violating QGT positivity', () => {
  assert.throws(() => quantumGeometryToScale({ g11: 1, g12: 0, g22: 1, curvature: 2.01 }), /QGT positivity violated/);
});

test('rejects degenerate metric', () => {
  assert.throws(() => quantumGeometryToScale({ g11: 1, g12: 1, g22: 1, curvature: 0 }), /positive and nondegenerate/);
});

test('rejects negative-definite metric', () => {
  assert.throws(() => quantumGeometryToScale({ g11: -1, g12: 0, g22: -1, curvature: 0 }), /diagonal entries must be positive/);
});

test('rejects zero metric diagonal', () => {
  assert.throws(() => quantumGeometryToScale({ g11: 0, g12: 0, g22: 1, curvature: 0 }), /diagonal entries must be positive/);
});
