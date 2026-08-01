#!/usr/bin/env node
/**
 * Simple append-only decision log
 * Records each procurement / integrated decision for later review.
 * Control704 high-priority override surface
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', 'data');
const LOG_FILE = join(LOG_DIR, 'decisions.jsonl');

export function recordDecision(entry) {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
  const line = JSON.stringify({
    ...entry,
    recordedAt: new Date().toISOString()
  }) + '\n';
  appendFileSync(LOG_FILE, line, 'utf8');
  return LOG_FILE;
}

export function readRecentDecisions(limit = 10) {
  if (!existsSync(LOG_FILE)) return [];
  const lines = readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

// CLI: node status/decision-log.mjs  → show recent
if (import.meta.url === `file://${process.argv[1]}`) {
  const recent = readRecentDecisions(15);
  console.log(JSON.stringify(recent, null, 2));
}
