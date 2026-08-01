#!/usr/bin/env node
/**
 * Simple append-only decision log
 * Control704 high-priority override surface
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', 'data');
const LOG_FILE = join(LOG_DIR, 'decisions.jsonl');

export function recordDecision(entry) {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  const line = JSON.stringify({
    ...entry,
    recordedAt: new Date().toISOString()
  }) + '\n';
  appendFileSync(LOG_FILE, line, 'utf8');
  return LOG_FILE;
}

export function readRecentDecisions(limit) {
  const config = loadConfig();
  const max = limit || config.decisionLogLimit || 20;
  if (!existsSync(LOG_FILE)) return [];
  const lines = readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-max).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

export function decisionMetrics(limit) {
  const recent = readRecentDecisions(limit);
  return recent.reduce((acc, d) => {
    const key = d.decision || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const recent = readRecentDecisions();
  const metrics = decisionMetrics();
  console.log(JSON.stringify({ metrics, recent }, null, 2));
}
