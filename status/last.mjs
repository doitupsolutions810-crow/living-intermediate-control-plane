#!/usr/bin/env node
/**
 * Show only the most recent decision
 * Control704 high-priority override surface
 */

import { readRecentDecisions } from './decision-log.mjs';

const recent = readRecentDecisions(1);
const last = recent.length ? recent[recent.length - 1] : null;

if (!last) {
  console.log(JSON.stringify({
    found: false,
    note: 'No decisions recorded yet. Run: npm run procure'
  }, null, 2));
  process.exit(0);
}

console.log(JSON.stringify({
  found: true,
  decision: last.decision,
  action: last.action,
  goal: last.goal,
  recordedAt: last.recordedAt,
  localEvidenceAccepted: last.localEvidenceAccepted,
  paused: last.paused
}, null, 2));
