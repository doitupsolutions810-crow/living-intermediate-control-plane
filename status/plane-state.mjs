#!/usr/bin/env node
/**
 * Simple persistent plane state (pause / resume)
 * Stored as a single JSON file so the integrated path can respect it.
 * Control704 high-priority override surface
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const STATE_FILE = join(DATA_DIR, 'plane-state.json');

const DEFAULT_STATE = {
  paused: false,
  pausedAt: null,
  reason: null,
  updatedAt: null
};

export function readPlaneState() {
  if (!existsSync(STATE_FILE)) return { ...DEFAULT_STATE };
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writePlaneState(update) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const current = readPlaneState();
  const next = {
    ...current,
    ...update,
    updatedAt: new Date().toISOString()
  };
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function pausePlane(reason = 'operator-pause') {
  return writePlaneState({
    paused: true,
    pausedAt: new Date().toISOString(),
    reason
  });
}

export function resumePlane() {
  return writePlaneState({
    paused: false,
    pausedAt: null,
    reason: null
  });
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] || 'status';
  if (cmd === 'pause') {
    console.log(JSON.stringify(pausePlane(process.argv[3] || 'operator-pause'), null, 2));
  } else if (cmd === 'resume') {
    console.log(JSON.stringify(resumePlane(), null, 2));
  } else {
    console.log(JSON.stringify(readPlaneState(), null, 2));
  }
}
