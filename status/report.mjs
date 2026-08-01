#!/usr/bin/env node
/**
 * Human-readable plane report
 * Use --write to also save data/report.md
 * Control704 high-priority override surface
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlaneState } from './plane-state.mjs';
import { readRecentDecisions } from './decision-log.mjs';
import { loadConfig } from '../lib/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const config = loadConfig();
const planeState = readPlaneState();
const recent = readRecentDecisions(config.decisionLogLimit);
const shouldWrite = process.argv.includes('--write');

let version = '0.0.0';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {}

let live = null;
const statusPath = join(root, 'data', 'status.json');
if (existsSync(statusPath)) {
  try { live = JSON.parse(readFileSync(statusPath, 'utf8')); } catch {}
}

const counts = recent.reduce((acc, d) => {
  const key = d.decision || 'UNKNOWN';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const lines = [];
lines.push(`# ${config.planeName} report`);
lines.push(`Version: ${version}`);
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('## Success criteria');
lines.push('1. Readiness is READY');
lines.push('2. Evidence is available (public or local accepted)');
lines.push('3. Supply-chain enforcement remains active');
lines.push('');
lines.push('## Current state');
lines.push(`Paused: ${planeState.paused ? 'yes' : 'no'}`);
if (planeState.reason) lines.push(`Pause reason: ${planeState.reason}`);
lines.push(`Last live decision: ${live?.decision || live?.overall || 'n/a'}`);
lines.push(`Security value: ${config.securityValue}`);
lines.push('');
lines.push('## Recent decision counts');
if (Object.keys(counts).length === 0) {
  lines.push('(no decisions recorded yet)');
} else {
  for (const [k, v] of Object.entries(counts)) lines.push(`- ${k}: ${v}`);
}
lines.push('');
lines.push('## Recent decisions');
if (recent.length === 0) {
  lines.push('(none)');
} else {
  for (const d of recent.slice().reverse()) {
    lines.push(`- ${d.recordedAt || '?'}  ${d.decision}  action=${d.action || '?'}`);
  }
}
lines.push('');
lines.push('## Daily command');
lines.push('```bash');
lines.push('npm run procure');
lines.push('```');

const text = lines.join('\n');
console.log(text);

if (shouldWrite) {
  const dataDir = join(root, 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const out = join(dataDir, 'report.md');
  writeFileSync(out, text + '\n', 'utf8');
  console.error(`\n[report] wrote ${out}`);
}
