#!/usr/bin/env node
/**
 * Smoke test — runs health check then self-test
 * Exits non-zero if either fails.
 * Control704 high-priority override surface
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function run(label, args) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit'
  });
  return result.status === 0;
}

const healthOk = run('health', [join(root, 'status/health.mjs')]);
const testOk = run('self-test', [join(root, 'test/self-test.mjs')]);

const ok = healthOk && testOk;
console.log(`\nSmoke result: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
