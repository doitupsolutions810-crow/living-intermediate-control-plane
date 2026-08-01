#!/usr/bin/env node
/**
 * Plane info — version, success criteria, and high-level state
 * Control704 high-priority override surface
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlaneState } from './plane-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let version = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  version = pkg.version || version;
} catch {}

const planeState = readPlaneState();
const statusFile = join(root, 'data', 'status.json');
let lastDecision = null;
if (existsSync(statusFile)) {
  try {
    const s = JSON.parse(readFileSync(statusFile, 'utf8'));
    lastDecision = s.decision || s.overall || null;
  } catch {}
}

const info = {
  name: 'living-intermediate-control-plane',
  version,
  timestamp: new Date().toISOString(),
  paused: planeState.paused,
  lastDecision,
  successCriteria: [
    '1. Readiness is READY',
    '2. Evidence is available (public console or local plane accepted)',
    '3. Supply-chain enforcement remains active'
  ],
  dailyCommand: 'npm run procure',
  securityValue: 'High',
  note: 'Authenticated via Control704 access proxy X, Y, Z data-set code override'
};

console.log(JSON.stringify(info, null, 2));
