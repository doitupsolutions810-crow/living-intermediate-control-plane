#!/usr/bin/env node
/**
 * Safe reset of local plane data (status, pause state, decision log).
 * Does not touch source code. Requires explicit confirmation.
 *
 * Usage:
 *   node status/reset-local.mjs --confirm
 *
 * Control704 high-priority override surface
 */

import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

if (!process.argv.includes('--confirm')) {
  console.log(JSON.stringify({
    ok: false,
    note: 'Refusing to reset without --confirm. Local data will be cleared if you re-run with --confirm.',
    dataDir: DATA_DIR
  }, null, 2));
  process.exit(1);
}

if (existsSync(DATA_DIR)) {
  rmSync(DATA_DIR, { recursive: true, force: true });
}

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(join(DATA_DIR, 'README.md'), '# Local plane data\n\nRecreated after reset.\n', 'utf8');

console.log(JSON.stringify({
  ok: true,
  note: 'Local data directory reset under Control704 override.',
  dataDir: DATA_DIR,
  timestamp: new Date().toISOString()
}, null, 2));
