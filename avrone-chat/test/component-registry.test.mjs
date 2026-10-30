import assert from 'node:assert/strict';
import test from 'node:test';
import { parseComponentRegistry } from '../lib/component-registry.mjs';

test('accepts a component registry with registered local components', () => {
  const components = [
    {
      id: 'audio.living-intermediate',
      version: '1.0.0',
      kind: 'audio',
      registeredAt: '2026-10-27T17:06:40.932Z',
      digest: 'abc123'
    }
  ];

  assert.deepEqual(parseComponentRegistry(components), {
    status: 'available',
    components
  });
});

test('accepts an empty registry as an available registry', () => {
  assert.deepEqual(parseComponentRegistry([]), {
    status: 'available',
    components: []
  });
});

test('rejects malformed registry shapes and component records', () => {
  for (const value of [
    null,
    {},
    { components: [] },
    [null],
    [{ id: 1 }],
    [{ id: '' }],
    [{ id: 'audio', kind: 2 }],
    [{ id: 'audio', digest: false }]
  ]) {
    assert.deepEqual(parseComponentRegistry(value), { status: 'invalid' });
  }
});
