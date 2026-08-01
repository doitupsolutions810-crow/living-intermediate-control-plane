#!/usr/bin/env node
/** Optional Drive/Gmail integration hints — no external API calls */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

function readJson(name) {
  const p = join(dataDir, name);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

const unattended = readJson('unattended-last.json');
const supply = readJson('supply-chain-last.json');
const admit = readJson('admit-change-last.json');

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  optionalConnectors: {
    google_drive: {
      purpose: 'Share plane reports / decision exports',
      localArtifacts: ['data/', 'npm run report:write'],
      action: 'Upload via Drive UI or connector — not required for plane operation'
    },
    gmail: {
      purpose: 'Alert on unattended/supply-chain/admit failure',
      triggerWhen: {
        unattendedFailed: unattended ? unattended.ok === false : null,
        supplyChainFailed: supply ? supply.ok === false : null,
        admitFailed: admit ? admit.ok === false : null
      },
      action: 'Send short status email via host script or Grok Gmail connector when asked'
    }
  },
  last: {
    unattended: unattended ? { ok: unattended.ok, at: unattended.timestamp } : null,
    supplyChain: supply ? { ok: supply.ok, at: supply.timestamp } : null,
    admit: admit ? { ok: admit.ok, at: admit.timestamp } : null
  },
  docs: 'docs/optional-notify.md'
}, null, 2));
