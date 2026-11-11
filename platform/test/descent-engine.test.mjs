// Regression: descent-engine.mjs had two unterminated string literals ('state and
// 'descent-engine.json) and failed to parse. No test imported it, so CI stayed green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DescentEngine } from '../src/bridge/descent-engine.mjs';

test('DescentEngine imports, ticks and persists state under stateDir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'descent-'));
  const e = new DescentEngine({ stateDir: dir, start: 2, k: 0.5 });
  assert.equal(e.stateFile, path.join(dir, 'descent-engine.json'));
  for (let i = 0; i < 20; i++) e.tick();
  assert.equal(e.stepCount, 20);
  assert.ok(fs.existsSync(e.stateFile), 'saves every 20 ticks');
  const again = new DescentEngine({ stateDir: dir });
  assert.equal(again.stepCount, 20);
  assert.equal(again.x, e.x);
  assert.ok(Number.isFinite(again.history.at(-1).S));
});

test('DescentEngine default stateDir is <cwd>/state', () => {
  const cwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'descent-cwd-'));
  process.chdir(dir);
  try {
    const e = new DescentEngine();
    assert.equal(e.stateFile, path.join(dir, 'state', 'descent-engine.json'));
  } finally { process.chdir(cwd); }
});
