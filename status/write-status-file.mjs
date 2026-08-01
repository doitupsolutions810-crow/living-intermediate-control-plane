#!/usr/bin/env node
/**
 * Write a simple machine-readable status file
 * so external tools or operators can read the last known state without running Node.
 * Control704 high-priority override surface
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const STATUS_FILE = join(DATA_DIR, 'status.json');

export function writeStatusFile(payload) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const record = {
    ...payload,
    writtenAt: new Date().toISOString()
  };
  writeFileSync(STATUS_FILE, JSON.stringify(record, null, 2), 'utf8');
  return STATUS_FILE;
}

export function getStatusFilePath() {
  return STATUS_FILE;
}
