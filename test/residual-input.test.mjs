import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResidualCoordinate } from '../lib/residual-input.mjs';

test('unset residual coordinate uses the documented default and stays cone-compliant', () => {
  assert.deepEqual(parseResidualCoordinate(undefined), {
    valid: true, value: 0, gateValue: 0, source: 'default',
    coneCompliant: true, decision: null, error: null
  });
});

test('finite numeric residual coordinates are preserved exactly', () => {
  assert.equal(parseResidualCoordinate('0').value, 0);
  assert.equal(parseResidualCoordinate('0.125').value, 0.125);
  assert.equal(parseResidualCoordinate('-0.125').value, -0.125);
});

test('empty, non-numeric, NaN, and infinite residual coordinates fail closed', () => {
  for (const raw of ['', '   ', 'not-a-number', 'NaN', 'Infinity', '-Infinity']) {
    const result = parseResidualCoordinate(raw);
    assert.equal(result.valid, false, JSON.stringify(raw));
    assert.equal(result.value, null, JSON.stringify(raw));
    assert.equal(result.gateValue, -1, JSON.stringify(raw));
    assert.equal(result.coneCompliant, false, JSON.stringify(raw));
    assert.equal(result.decision, 'HOLD_INVALID_RESIDUAL', JSON.stringify(raw));
    assert.match(result.error, /GREAT_SCALE_S/);
  }
});

test('numeric overflow is rejected rather than entering residual math', () => {
  const result = parseResidualCoordinate('1e999');
  assert.equal(result.valid, false);
  assert.equal(result.value, null);
  assert.equal(result.decision, 'HOLD_INVALID_RESIDUAL');
});

test('finite but cone-violating coordinates produce an explicit cone hold', () => {
  const result = parseResidualCoordinate('-0.125');
  assert.equal(result.valid, true);
  assert.equal(result.coneCompliant, false);
  assert.equal(result.decision, 'HOLD_RESIDUAL_CONE');
  assert.equal(result.gateValue, -0.125);
});

test('finite cone-compliant coordinates do not create a residual hold', () => {
  const result = parseResidualCoordinate('0.125');
  assert.equal(result.valid, true);
  assert.equal(result.coneCompliant, true);
  assert.equal(result.decision, null);
});
