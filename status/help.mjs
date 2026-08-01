#!/usr/bin/env node

const help = `
Living Intermediate Control Plane — operator commands

Setup
  npm run init              Create local data dir and ensure config exists

Daily
  npm run procure           Full check + accept local evidence
  npm run dry-run           Same check without recording
  npm run snapshot          Current state + recent decisions
  npm run health            Exit 0 only when healthy
  npm run doctor            Integrity diagnostics
  npm run info              Version + success criteria
  npm run security-summary  Supply-chain / CI posture
  npm run report            Human-readable report
  npm run last              Most recent decision
  npm run help              This list

Control
  npm run pause / resume / state
  npm run log / export / actions

Background
  npm run continuous / watch

CI & containers
  npm run ci                Local CI suite
  npm run docker:build      Build image
  npm run docker:doctor     Run doctor in image
  npm run smoke / test

Success criteria (only three)
  1. Readiness is READY
  2. Evidence is available (public or local accepted)
  3. Supply-chain enforcement remains active
`;

console.log(help.trim());
