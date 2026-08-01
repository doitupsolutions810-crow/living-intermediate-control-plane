#!/usr/bin/env node
/**
 * Decision metrics from the local log
 */

import { decisionMetrics, readRecentDecisions } from './decision-log.mjs';
import { loadConfig } from '../lib/config.mjs';

const config = loadConfig();
const limit = Number(process.env.METRICS_LIMIT) || config.decisionLogLimit || 50;
const metrics = decisionMetrics(limit);
const recent = readRecentDecisions(Math.min(5, limit));

const total = Object.values(metrics).reduce((a, b) => a + b, 0);

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  limit,
  total,
  byDecision: metrics,
  recent: recent.map(d => ({
    decision: d.decision,
    action: d.action,
    recordedAt: d.recordedAt
  })),
  note: total === 0 ? 'No decisions recorded yet. Run: npm run procure' : 'Counts from local decision log.'
}, null, 2));
