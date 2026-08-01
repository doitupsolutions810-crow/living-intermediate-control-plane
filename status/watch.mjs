#!/usr/bin/env node
/**
 * Watch mode — periodically runs the integrated check
 * Control704 high-priority override surface
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const config = loadConfig();
const interval = Number(process.env.WATCH_INTERVAL_MS) || config.watchIntervalMs || 60000;
const acceptLocal = process.env.ACCEPT_LOCAL_EVIDENCE === '1' || config.acceptLocalEvidenceByDefault;

function runOnce() {
  const env = { ...process.env };
  if (acceptLocal) env.ACCEPT_LOCAL_EVIDENCE = '1';
  const child = spawn(process.execPath, [join(root, 'integrate.mjs'), 'status'], {
    env,
    stdio: 'inherit'
  });
  child.on('exit', (code) => {
    console.error(`[watch] integrate exited ${code} — next run in ${interval}ms`);
  });
}

console.error(`[watch] starting — interval ${interval}ms, acceptLocalEvidence=${acceptLocal}`);
runOnce();
setInterval(runOnce, interval);
