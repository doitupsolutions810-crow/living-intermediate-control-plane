import assert from 'node:assert/strict';
import { GREAT_SCALE, validateGreatScaleState } from '../src/scale/great-scale.mjs';
import { runCockpitAction } from '../src/cockpit/action.mjs';

const valid = {
  zeroMode: GREAT_SCALE.phi,
  tolerance: 0.001,
  residualPartition: [4, 3, 1],
  psi: GREAT_SCALE.psiFloor,
  geometry: {
    heightRatio: 1,
    radialLambda: Math.pow(GREAT_SCALE.phi, -3),
    n: 3,
    symmetry: 9,
    inwardFold: 0.8,
    generatedByScale: true
  },
  perspectives: ['Watch', 'Observer', 'Forward', 'Adjacent', 'Down']
};

const result = validateGreatScaleState(valid);
assert.equal(result.schema, 'great-scale.validation/v1');
assert.equal(result.decision, 'READY');
assert.deepEqual(result.failedGates, []);
assert.ok(result.checks.every(c => c.status === 'pass'));

// Exercise the CONTROL12 cockpit dispatch path, both supported body shapes.
const dispatched = await runCockpitAction('great_scale_validate', { state: valid }, {});
assert.equal(dispatched.decision, 'READY');
const dispatchedBody = await runCockpitAction('great_scale_validate', valid, {});
assert.equal(dispatchedBody.decision, 'READY');

const lowPsi = validateGreatScaleState({ ...valid, psi: GREAT_SCALE.psiFloor - 0.01 });
assert.equal(lowPsi.decision, 'NOT_READY');
assert.ok(lowPsi.failedGates.includes('psi-cone-floor'));

const wrongPartition = validateGreatScaleState({ ...valid, residualPartition: [4, 2, 2] });
assert.ok(wrongPartition.failedGates.includes('residual-partition'));

const wrongGeometry = validateGreatScaleState({
  ...valid,
  geometry: { ...valid.geometry, generatedByScale: false }
});
assert.ok(wrongGeometry.failedGates.includes('geometry-provenance'));

const optionalPerspectives = { ...valid };
delete optionalPerspectives.perspectives;
const withoutOptionalPerspectives = validateGreatScaleState(optionalPerspectives);
assert.equal(withoutOptionalPerspectives.decision, 'READY');
assert.ok(withoutOptionalPerspectives.checks.find(c => c.id === 'perspective-coverage').status === 'not-provided');

const missing = validateGreatScaleState({ zeroMode: GREAT_SCALE.phi });
assert.equal(missing.decision, 'INCOMPLETE');
assert.ok(missing.missingGates.length > 0);

const badTolerance = validateGreatScaleState({ tolerance: -1 });
assert.equal(badTolerance.decision, 'INVALID_INPUT');

console.log('PASS: Great-Scale CONTROL12 invariant and cockpit-dispatch tests');
