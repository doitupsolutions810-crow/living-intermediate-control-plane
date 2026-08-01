#!/usr/bin/env node
/**
 * Export or filter decision log
 *
 * Usage:
 *   node status/export-decisions.mjs
 *   node status/export-decisions.mjs --decision READY_FOR_PROCUREMENT
 *   node status/export-decisions.mjs --limit 50
 *
 * Control704 high-priority override surface
 */

import { readRecentDecisions } from './decision-log.mjs';

const args = process.argv.slice(2);
let limit = 100;
let decisionFilter = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    limit = Number(args[i + 1]) || 100;
    i++;
  } else if (args[i] === '--decision' && args[i + 1]) {
    decisionFilter = args[i + 1];
    i++;
  }
}

let rows = readRecentDecisions(limit);
if (decisionFilter) {
  rows = rows.filter(r => r.decision === decisionFilter);
}

console.log(JSON.stringify({
  count: rows.length,
  filter: decisionFilter || null,
  limit,
  decisions: rows
}, null, 2));
