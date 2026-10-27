import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResidualCoordinate } from '../lib/residual-input.mjs';

test('unset residual coordinate uses the documented default', () => {
  assert.deepEqual(parseResidualCoordinate(undefined), {
    valid: true, value: 0, source: 'default', error: null
  });
});

test('finite numeric residual coordinates are preserved exactly', () => {
  assert.deepEqual(parseResidualCoordinate('0'), {
    valid: true, value: 0, source: 'environment', error: null
  });
  assert.equal(parseResidualCoordinate('0.125').value, 0.125);
  assert.equal(parseResidualCoordinate('-0.125').value, -0.125);
});

test('empty, non-numeric, NaN, and infinite residual coordinates fail closed', () => {
  for (const raw of ['', '   ', 'not-a-number', 'NaN', 'Infinity', '-Infinity']) {
    const result = parseResidualCoordinate(raw);
    assert.equal(result.valid, false, JSON.stringify(raw));
    assert.equal(result.value, null, JSON.stringify(raw));
    assert.match(result.error, /GREAT_SCALE_S/);
  }
});

test('numeric overflow is rejected rather than entering residual math', () => {
  const result = parseResidualCoordinate('1e999');
  assert.equal(result.valid, false);
  assert.equal(result.value, null);
});
