import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSessionLinkStore } from '../src/attestation/session-link.mjs';

test('missing session-link log is an empty store', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'session-link-store-'));
  try {
    const store = createSessionLinkStore(path.join(root, 'missing'));
    assert.deepEqual(await store.list(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('valid JSONL records are returned newest-first with limit', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'session-link-store-'));
  try {
    const dir = path.join(root, 'attestations');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'session-links.jsonl'), '{"sessionId":"s1"}\n{"sessionId":"s2"}\n', 'utf8');
    const store = createSessionLinkStore(dir);
    assert.deepEqual(await store.list(1), [{ sessionId: 's2' }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('corrupt JSONL fails explicitly instead of returning empty history', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'session-link-store-'));
  try {
    const dir = path.join(root, 'attestations');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'session-links.jsonl'), '{"sessionId":"s1"}\n{truncated\n', 'utf8');
    const store = createSessionLinkStore(dir);
    await assert.rejects(store.list(), (error) => {
      assert.equal(error.code, 'ERR_SESSION_LINK_LOG_CORRUPT');
      assert.equal(error.line, 2);
      return true;
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('append then list round-trips a record', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'session-link-store-'));
  try {
    const store = createSessionLinkStore(path.join(root, 'attestations'));
    await store.append({ sessionId: 's1', linkDigest: 'abc' });
    assert.deepEqual(await store.list(), [{ sessionId: 's1', linkDigest: 'abc' }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('concurrent appends remain parseable and all completed writes are present', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'session-link-store-'));
  try {
    const store = createSessionLinkStore(path.join(root, 'attestations'));
    const count = 64;
    await Promise.all(Array.from({ length: count }, (_, i) =>
      store.append({ sessionId: `s${i}`, sequence: i })
    ));
    const records = await store.list(count);
    assert.equal(records.length, count);
    assert.deepEqual(new Set(records.map((record) => record.sequence)), new Set(Array.from({ length: count }, (_, i) => i)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
