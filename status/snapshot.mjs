#!/usr/bin/env node
/**
 * Operator snapshot — pause state, live status, recent decisions, security files
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlaneState } from './plane-state.mjs';
import { readRecentDecisions } from './decision-log.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const STATUS_FILE = join(root, 'data', 'status.json');

function readStatusFile() {
  if (!existsSync(STATUS_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

const planeState = readPlaneState();
const liveStatus = readStatusFile();
const recent = readRecentDecisions(5);

const snapshot = {
  timestamp: new Date().toISOString(),
  paused: planeState.paused,
  pauseReason: planeState.reason,
  liveStatus: liveStatus
    ? {
        decision: liveStatus.decision || liveStatus.overall,
        action: liveStatus.action,
        readiness: liveStatus.readiness?.overall || liveStatus.readiness?.overallDecision,
        writtenAt: liveStatus.writtenAt || liveStatus.timestamp
      }
    : null,
  recentDecisions: recent.map(d => ({
    decision: d.decision,
    action: d.action,
    recordedAt: d.recordedAt
  })),
  securityFiles: {
    trivyConfig: existsSync(join(root, 'trivy.yaml')),
    trivyIgnore: existsSync(join(root, '.trivyignore')),
    opaPolicy: existsSync(join(root, 'policy/trivy-results.rego')),
    dockerfile: existsSync(join(root, 'Dockerfile')),
    ciWorkflow: existsSync(join(root, '.github/workflows/plane-ci.yml'))
  },
  securityValue: 'High',
  note: planeState.paused
    ? 'Plane is paused. Use npm run resume to clear.'
    : 'Plane is active. Use npm run procure for a full check, or npm run next for advice.'
};

console.log(JSON.stringify(snapshot, null, 2));
