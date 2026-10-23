import test from 'node:test';
import assert from 'node:assert/strict';
import { quantumGeometryToScale } from '../src/bridge/quantum-geometry.mjs';
import { CONE } from '../src/bridge/great-scale.mjs';
import { qiWuZhangChernNumber, qiWuZhangLocalQGT, qiWuZhangGlobalGeometry } from '../src/bridge/topological-qgt.mjs';

function close(a, b, tolerance = 1e-8) { assert.ok(Math.abs(a - b) <= tolerance, a + ' != ' + b); }

test('QWZ lower band has Chern number -1 for m=-1', () => close(qiWuZhangChernNumber(-1), -1));
test('QWZ lower band has Chern number +1 for m=+1', () => close(qiWuZhangChernNumber(1), 1));
test('QWZ trivial phase m=3 has Chern number zero', () => close(qiWuZhangChernNumber(3), 0));
test('all phase-boundary masses are rejected even on odd grids', () => {
  for (const m of [-2, 0, 2]) assert.throws(() => qiWuZhangChernNumber(m, 41), /phase boundary/);
});
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
test('signed local curvature integral agrees with the FHS Chern orientation', () => {
  for (const m of [-1, 1]) {
    const d = qiWuZhangGlobalGeometry(m, 40);
    assert.ok(Math.sign(d.integratedCurvature) === Math.sign(d.chernNumber), 'curvature integral and FHS Chern sign must agree');
    assert.ok(Math.abs(d.integratedCurvature - d.chernNumber) < 0.1, '40x40 quadrature error should remain bounded; refine for tighter accuracy');
  }
});
test('metric-area budget obeys the Chern lower bound and maps into Great Scale', () => {
  for (const m of [-1, 1]) {
    const d = qiWuZhangGlobalGeometry(m, 40);
    assert.ok(d.metricAreaBudget >= Math.abs(d.chernNumber) - 1e-9);
    close(d.metricAreaBudget, d.absoluteCurvatureBudget, 1e-8);
    assert.ok(d.metricAreaExcess > 0);
    assert.ok(d.topologicalSaturation >= 0 && d.topologicalSaturation <= 1);
    close(d.psiTopological, CONE + d.STopological, 1e-12);
  }
  const trivial = qiWuZhangGlobalGeometry(3, 40);
  close(trivial.chernNumber, 0);
  close(trivial.topologicalSaturation, 0);
  close(trivial.STopological, 0.25);
  close(trivial.psiTopological, CONE + 0.25);
  assert.ok(trivial.metricAreaBudget > 0);
});
test('global metric-area budget converges under grid refinement', () => {
  close(qiWuZhangGlobalGeometry(-1, 40).metricAreaBudget, qiWuZhangGlobalGeometry(-1, 80).metricAreaBudget, 2e-4);
  close(qiWuZhangGlobalGeometry(1, 40).metricAreaBudget, qiWuZhangGlobalGeometry(1, 80).metricAreaBudget, 2e-4);
});
test('Chern invariant is stable across a phase sweep away from gap closings', () => {
  const sweep = [
    [-3, 0], [-2.5, 0], [-1.5, -1], [-1, -1], [-0.5, -1],
    [0.5, 1], [1, 1], [1.5, 1], [2.5, 0], [3, 0]
  ];
  for (const [m, expected] of sweep) {
    const raw = qiWuZhangChernNumber(m, 40);
    close(Math.round(raw), expected, 1e-8);
    close(raw, Math.round(raw), 1e-5);
  }
});
test('curvature quadrature converges across refinement for phases away from transitions', () => {
  for (const m of [-1, 1, 3]) {
    const coarse = qiWuZhangGlobalGeometry(m, 40).integratedCurvature;
    const fine = qiWuZhangGlobalGeometry(m, 80).integratedCurvature;
    assert.ok(Math.abs(fine - Math.round(fine)) <= Math.abs(coarse - Math.round(coarse)) + 1e-9,
      'refined quadrature should not worsen the error at m=' + m);
  }
});
test('quadrature diagnostics are sensitive to sampling-grid alignment near transitions', () => {
  const near = qiWuZhangGlobalGeometry(-1.99, 40);
  assert.equal(near.chernNumber, -1);
  assert.equal(near.quadratureConverged, false);
  assert.equal(near.topologicalMappingValid, false);
  assert.ok(near.gridAlignmentAreaDiscrepancy > 0.1);
  assert.ok(near.metricAreaQuadratureError > 0.1);
  assert.ok(near.refinementCount >= 2);
  assert.ok(near.refinedGridSize >= 160);
  assert.ok(near.topologicalSaturationRaw > 0);

  const stable = qiWuZhangGlobalGeometry(-1, 40);
  assert.equal(stable.quadratureConverged, true);
  assert.equal(stable.topologicalMappingValid, true);
  assert.ok(stable.gridAlignmentAreaDiscrepancy <= stable.quadratureTolerance);
});
test('metric-area excess measures minority-sign curvature cancellation in converged phases', () => {
  for (const m of [-1, 1, 3]) {
    const d = qiWuZhangGlobalGeometry(m, 40);
    assert.equal(d.topologicalMappingValid, true);
    assert.ok(d.positiveCurvatureBudget >= 0);
    assert.ok(d.negativeCurvatureBudget >= 0);
    close(d.curvatureCancellationBudget,
      2 * Math.min(d.positiveCurvatureBudget, d.negativeCurvatureBudget), 1e-10);
    close(d.metricAreaExcess, d.curvatureCancellationBudget, 2e-3);
  }
});

test('Richardson-style quadrature estimates are exposed and bounded on stable phases', () => {
  for (const m of [-1, 1, 3]) {
    const d = qiWuZhangGlobalGeometry(m, 40);
    assert.equal(d.quadratureConverged, true);
    assert.ok(Number.isFinite(d.metricAreaRichardsonErrorEstimate));
    assert.ok(Number.isFinite(d.curvatureRichardsonErrorEstimate));
    close(d.metricAreaRichardsonErrorEstimate, d.metricAreaQuadratureError / 3, 1e-12);
    close(d.curvatureRichardsonErrorEstimate, d.curvatureQuadratureError / 3, 1e-12);
    const orderWindow = value => value !== null && value >= 1.5 && value <= 2.5;
    assert.equal(d.richardsonAsymptotic,
      orderWindow(d.metricAreaObservedOrder) && orderWindow(d.curvatureObservedOrder));
    // Even when the order estimate is unavailable, stability acceptance is based on
    // direct consecutive-grid differences and grid-origin disagreement.
    assert.ok(d.metricAreaRichardsonErrorEstimate <= d.metricAreaQuadratureError / 3 + 1e-12);
    assert.ok(d.metricAreaQuadratureError <= d.quadratureTolerance);
  }
});

test('Great Scale correction equals normalized opposite-curvature mixing in converged phases', () => {
  for (const m of [-1, 1, 3]) {
    const d = qiWuZhangGlobalGeometry(m, 40);
    assert.equal(d.topologicalMappingValid, true);
    close(d.curvatureMixingIndex,
      d.positiveCurvatureBudget * d.negativeCurvatureBudget / (d.metricAreaBudget ** 2), 1e-12);
    close(d.curvatureMixingResidual, Math.abs(d.STopological - d.curvatureMixingIndex), 1e-12);
    assert.ok(d.curvatureMixingResidual < 2e-3,
      'integer-C scalar and sampled curvature mixing should agree in converged phase m=' + m);
  }
});

test('gap-aware quadrature tightens tolerance near every transition', () => {
  for (const m of [-1.99, -0.01, 0.01, 1.99, 2.01]) {
    const d = qiWuZhangGlobalGeometry(m, 40);
    assert.ok(d.gapDistance > 0);
    assert.ok(d.gapAwareToleranceScale >= 0.05 && d.gapAwareToleranceScale <= 1);
    close(d.gapAwareToleranceScale, Math.min(1, Math.max(0.05, d.gapDistance / 0.25)), 1e-12);
    assert.ok(d.topologicalMappingValid === false || d.quadratureTolerance <= 1e-3 * Math.max(1, Math.abs(d.metricAreaBudget)));
  }
});

test('curvature orientation variance and minority-sign cancellation identity map into Great Scale', () => {
  for (const m of [-1, 1, 3]) {
    const d = qiWuZhangGlobalGeometry(m, 40);
    assert.equal(d.topologicalMappingValid, true);
    close(d.minorityCurvatureBudget, Math.min(d.positiveCurvatureBudget, d.negativeCurvatureBudget), 1e-12);
    close(d.curvatureCancellationIdentityResidual,
      Math.abs(d.metricAreaExcess - 2 * d.minorityCurvatureBudget), 1e-12);
    close(d.curvatureOrientationVariance, 1 - d.topologicalSaturation ** 2, 1e-12);
    close(d.curvatureOrientationVarianceFromBudgets, 4 * d.curvatureMixingIndex, 1e-12);
    close(d.curvatureOrientationVarianceResidual,
      Math.abs(d.curvatureOrientationVariance - d.curvatureOrientationVarianceFromBudgets), 1e-12);
    assert.ok(d.curvatureChernResidual <= d.quadratureTolerance);
    assert.ok(d.curvatureCancellationIdentityResidual <= 2 * d.quadratureTolerance);
  }
});

test('signed topological polarization restores orientation lost by the Great Scale scalar', () => {
  const negative = qiWuZhangGlobalGeometry(-1, 40);
  const positive = qiWuZhangGlobalGeometry(1, 40);
  const trivial = qiWuZhangGlobalGeometry(3, 40);
  for (const d of [negative, positive, trivial]) {
    assert.equal(d.topologicalMappingValid, true);
    close(d.signedTopologicalPolarization, d.chernNumber / d.metricAreaBudget, 1e-12);
  }
  close(negative.psiTopological, positive.psiTopological, 1e-10);
  close(negative.signedTopologicalPolarization, -positive.signedTopologicalPolarization, 1e-10);
  close(trivial.signedTopologicalPolarization, 0, 1e-12);
  close(trivial.STopological, 0.25, 1e-12);
  close(trivial.psiTopological, CONE + 0.25, 1e-12);
  assert.ok(trivial.metricAreaBudget > 0);
});

test('curvature-orientation Shannon entropy is the monotone information form of Great Scale heat', () => {
  const entropy = p => (p > 0 ? -p * Math.log(p) : 0) + (p < 1 ? -(1 - p) * Math.log1p(-p) : 0);
  const stable = [-1, -0.5, 3].map(m => qiWuZhangGlobalGeometry(m, 40));
  for (const d of stable) {
    assert.equal(d.topologicalMappingValid, true);
    close(d.curvatureOrientationEntropyNats,
      entropy((1 + d.signedTopologicalPolarization) / 2), 1e-12);
    close(d.curvatureOrientationEntropyBits,
      d.curvatureOrientationEntropyNats / Math.LN2, 1e-12);
    const total = d.positiveCurvatureBudget + d.negativeCurvatureBudget;
    const budgetEntropy = entropy(d.positiveCurvatureBudget / total);
    close(d.curvatureBudgetEntropyNats, budgetEntropy, 1e-12);
    close(d.curvatureOrientationEntropyResidual,
      Math.abs(d.curvatureOrientationEntropyNats - budgetEntropy), 1e-12);
    assert.ok(d.curvatureOrientationEntropyResidual <= 2 * d.quadratureTolerance);
    assert.ok(d.curvatureOrientationEntropyBits >= 0 && d.curvatureOrientationEntropyBits <= 1);
  }
  assert.ok(stable[0].STopological < stable[1].STopological);
  assert.ok(stable[1].STopological < stable[2].STopological);
  assert.ok(stable[0].curvatureOrientationEntropyNats < stable[1].curvatureOrientationEntropyNats);
  assert.ok(stable[1].curvatureOrientationEntropyNats < stable[2].curvatureOrientationEntropyNats);
  close(stable[2].curvatureOrientationEntropyNats, Math.LN2, 1e-12);
  close(stable[2].curvatureOrientationEntropyBits, 1, 1e-12);
  const underResolved = qiWuZhangGlobalGeometry(-1.99, 40);
  assert.equal(underResolved.topologicalMappingValid, false);
  assert.ok(underResolved.curvatureOrientationEntropyResidual > underResolved.quadratureTolerance);
});
test('numerically accepted scalar is withheld when quadrature is under-resolved', () => {
  const near = qiWuZhangGlobalGeometry(-1.99, 40);
  assert.equal(near.topologicalMappingValid, false);
  assert.equal(near.acceptedPsiTopological, null);
  const stable = qiWuZhangGlobalGeometry(-1, 40);
  assert.equal(stable.topologicalMappingValid, true);
  close(stable.acceptedPsiTopological, stable.psiTopological, 1e-12);
});
