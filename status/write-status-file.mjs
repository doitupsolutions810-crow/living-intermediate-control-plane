#!/usr/bin/env node
/**
 * Write a machine-readable status file so external tools or operators
 * can read the last known state without running Node.
 *
 * GSLI: optionally attaches a residual-aware evidence status document
 * (great-scale.evidence-status/v5.4.0) under `evidenceStatus`.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildEvidenceStatusDocument,
  sealEvidenceStatusDocument,
} from '../lib/evidence-status-document.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const STATUS_FILE = join(DATA_DIR, 'status.json');
const EVIDENCE_STATUS_FILE = join(DATA_DIR, 'evidence-status.json');

/**
 * @param {object} payload
 * @param {object} [opts]
 * @param {boolean} [opts.attachEvidenceStatus=true]
 * @param {number} [opts.S]
 * @param {number|null} [opts.tau]
 * @param {number} [opts.roleBlock]
 */
export function writeStatusFile(payload, opts = {}) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const {
    attachEvidenceStatus = true,
    S = Number(process.env.GREAT_SCALE_S || payload?.residual?.S || 0) || 0,
    tau = payload?.residual?.tau ?? null,
    roleBlock = payload?.residual?.roleBlock ?? 4,
  } = opts;

  let evidenceStatus = null;
  if (attachEvidenceStatus) {
    const doc = buildEvidenceStatusDocument({
      S,
      tau,
      roleBlock,
      authority: payload?.evidenceConsole?.authority || 'local',
    });
    evidenceStatus = sealEvidenceStatusDocument(doc);
    writeFileSync(EVIDENCE_STATUS_FILE, JSON.stringify(evidenceStatus, null, 2), 'utf8');
  }

  const record = {
    ...payload,
    evidenceStatus,
    writtenAt: new Date().toISOString(),
  };
  writeFileSync(STATUS_FILE, JSON.stringify(record, null, 2), 'utf8');
  return { statusFile: STATUS_FILE, evidenceStatusFile: evidenceStatus ? EVIDENCE_STATUS_FILE : null };
}

export function getStatusFilePath() {
  return STATUS_FILE;
}

export function getEvidenceStatusFilePath() {
  return EVIDENCE_STATUS_FILE;
}
