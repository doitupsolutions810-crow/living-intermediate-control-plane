import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ComponentRegistry } from '../src/attestation/component-registry.mjs';

test('missing registry starts empty and can persist registered components', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'control12-registry-'));
  const file = path.join(directory, 'components.json');

  try {
    const registry = new ComponentRegistry(file);
    assert.deepEqual(await registry.list(), []);

    await registry.register({ id: 'test.component', version: '1.0.0', kind: 'test' });

    const reloaded = new ComponentRegistry(file);
    assert.deepEqual(
      (await reloaded.list()).map(({ id, version, kind }) => ({ id, version, kind })),
      [{ id: 'test.component', version: '1.0.0', kind: 'test' }]
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('malformed registry JSON is surfaced instead of becoming an empty registry', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'control12-registry-'));
  const file = path.join(directory, 'components.json');

  try {
    await fs.writeFile(file, '{invalid json');
    const registry = new ComponentRegistry(file);

    await assert.rejects(registry.list(), SyntaxError);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('unexpected registry read errors are surfaced', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'control12-registry-'));
  const file = path.join(directory, 'components.json');

  try {
    await fs.mkdir(file);
    const registry = new ComponentRegistry(file);

    await assert.rejects(registry.list(), { code: 'EISDIR' });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('invalid registry document shape is rejected', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'control12-registry-'));
  const file = path.join(directory, 'components.json');

  try {
    await fs.writeFile(file, JSON.stringify({ components: [] }));
    const registry = new ComponentRegistry(file);

    await assert.rejects(registry.list(), /components object/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
