import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResidualCoordinate } from '../lib/residual-input.mjs';

test('unset residual coordinate uses the documented default', () => {
  assert.deepEqual(parseResidualCoordinate(undefined), {
    valid: true, value: 0, gateValue: 0, source: 'default',
    coneCompliant: true, decision: null, error: null
  });
});

test('finite decimal coordinates within [0, 0.25] are preserved', () => {
  for (const raw of ['0', '0.125', '0.25', '.125', '1.25e-1']) {
    const result = parseResidualCoordinate(raw);
    assert.equal(result.valid, true, raw);
    assert.equal(result.value, Number(raw), raw);
    assert.equal(result.decision, null, raw);
  }
});

test('empty, non-decimal, non-numeric, NaN, and infinite values fail closed', () => {
  for (const raw of ['', '   ', 'not-a-number', 'NaN', 'Infinity', '-Infinity', '0x10', '0b10']) {
    const result = parseResidualCoordinate(raw);
    assert.equal(result.valid, false, JSON.stringify(raw));
    assert.equal(result.value, null, JSON.stringify(raw));
    assert.equal(result.gateValue, -1, JSON.stringify(raw));
    assert.equal(result.coneCompliant, false, JSON.stringify(raw));
    assert.equal(result.decision, 'HOLD_INVALID_RESIDUAL', JSON.stringify(raw));
    assert.match(result.error, /GREAT_SCALE_S/);
  }
});

test('overflow and underflow outside representable model intent are not accepted as valid coordinates', () => {
  for (const raw of ['1e999', '-1e999', '1e-999', '1e-324']) {
    assert.equal(parseResidualCoordinate(raw).decision, 'HOLD_INVALID_RESIDUAL');
  }
});

test('finite coordinates outside topology-derived domain [0, 0.25] produce a domain hold', () => {
  for (const raw of ['-0.0001', '-0.125', '0.2500001', '1', '1e100']) {
    const result = parseResidualCoordinate(raw);
    assert.equal(result.valid, false, raw);
    assert.equal(result.value, null, raw);
    assert.equal(result.decision, 'HOLD_RESIDUAL_DOMAIN', raw);
    assert.match(result.error, /\[0, 0\.25\]/);
  }
});

test('exact domain boundaries are accepted', () => {
  assert.equal(parseResidualCoordinate('0').decision, null);
  assert.equal(parseResidualCoordinate('0.25').decision, null);
});

test('no supplied invalid or out-of-domain coordinate is normalized to a successful zero', () => {
  for (const raw of ['NaN', 'Infinity', '-0.125', '0.251', '1e100']) {
    const result = parseResidualCoordinate(raw);
    assert.notEqual(result.valid && result.value === 0, true, raw);
    assert.notEqual(result.decision, null, raw);
  }
});
