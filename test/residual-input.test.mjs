import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResidualCoordinate, parseTopologySaturation } from '../lib/residual-input.mjs';
import { coneCompliant } from '../lib/great-scale-residual.mjs';

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


test('cone floor is not treated as an independent domain or finiteness validator', () => {
  // Characterize the algebraic limitation: psi(S)=CONE+S, so the floor alone
  // accepts these values. The parser must still reject them at the boundary.
  assert.equal(coneCompliant(Infinity), true);
  assert.equal(coneCompliant(1e100), true);
  assert.equal(parseResidualCoordinate('Infinity').decision, 'HOLD_INVALID_RESIDUAL');
  assert.equal(parseResidualCoordinate('1e100').decision, 'HOLD_RESIDUAL_DOMAIN');
});


test('topology saturation parser accepts only faithful finite decimal values in [0, 1]', () => {
  for (const raw of ['0', '0.5', '1', '.25', '2.5e-1']) {
    const result = parseTopologySaturation(raw);
    assert.equal(result.valid, true, raw);
    assert.equal(result.value, Number(raw), raw);
  }
  for (const raw of ['', ' ', 'NaN', 'Infinity', '-Infinity', 'nope', '1e999', '1e-999', '-0.01', '1.01']) {
    const result = parseTopologySaturation(raw);
    assert.equal(result.valid, false, JSON.stringify(raw));
    assert.equal(result.value, null, JSON.stringify(raw));
    assert.match(result.error, /tau/);
  }
  assert.deepEqual(parseTopologySaturation(undefined), { valid: true, value: null, error: null });
});

test('residual command-line entry points reject malformed coordinates instead of coercing or clamping', async () => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..');
  for (const [script, args, expected] of [
    ['status/residual-snapshot.mjs', ['--tau', 'Infinity'], /tau must be finite/],
    ['status/residual-snapshot.mjs', ['--S', 'nonsense'], /GREAT_SCALE_S/],
    ['status/evidence-status.mjs', ['emit', '--S', 'nonsense'], /GREAT_SCALE_S/],
    ['status/evidence-status.mjs', ['emit', '--tau', '1.01'], /tau must be within/]
  ]) {
    const result = spawnSync(process.execPath, [resolve(root, script), ...args], {
      cwd: root, encoding: 'utf8'
    });
    assert.notEqual(result.status, 0, script + ' ' + args.join(' '));
    assert.match(result.stderr, expected);
  }
});
