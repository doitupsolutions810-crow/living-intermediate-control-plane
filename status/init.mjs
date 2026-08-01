#!/usr/bin/env node
/**
 * Initialize local plane data and confirm config is present.
 * Safe to run multiple times.
 * Control704 high-priority override surface
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const configPath = join(root, 'config.json');

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

if (!existsSync(join(dataDir, 'README.md'))) {
  writeFileSync(join(dataDir, 'README.md'), '# Local plane data\n\nCreated by npm run init.\n', 'utf8');
}

let configOk = existsSync(configPath);
if (!configOk) {
  const defaults = {
    acceptLocalEvidenceByDefault: false,
    readinessIntervalMs: 30000,
    watchIntervalMs: 60000,
    decisionLogLimit: 20,
    planeName: 'living-intermediate-control-plane',
    securityValue: 'High'
  };
  writeFileSync(configPath, JSON.stringify(defaults, null, 2) + '\n', 'utf8');
  configOk = true;
}

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {}

console.log(JSON.stringify({
  ok: true,
  version,
  dataDir,
  configPresent: configOk,
  note: 'Plane initialized under Control704 override.',
  timestamp: new Date().toISOString()
}, null, 2));
