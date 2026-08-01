#!/usr/bin/env node
/**
 * Help — list all operator commands
 */

const help = `
Living Intermediate Control Plane — operator commands

Setup
  npm run init         Create local data dir and ensure config exists

Daily
  npm run procure      Full check + accept local evidence
  npm run dry-run      Same check without recording
  npm run check        Full integrated check only
  npm run snapshot     Current state + recent decisions
  npm run health       Exit 0 only when healthy
  npm run doctor       Deeper integrity diagnostics
  npm run info         Version + success criteria
  npm run report       Human-readable report
  npm run report:write Save report to data/report.md
  npm run last         Most recent decision
  npm run export       Export / filter decision log
  npm run help         This list

Control
  npm run pause        Hold further procure decisions
  npm run resume       Clear pause
  npm run state        Show pause state
  npm run log          Recent decision log + metrics
  npm run actions      List named LaunchDesk actions

Background
  npm run continuous   Keep status file fresh
  npm run watch        Periodically run integrated check

CI / maintenance
  npm run ci           Full CI suite (local)
  npm run smoke        Health + self-test
  npm run reset-local -- --confirm
  npm test

Success criteria (only three)
  1. Readiness is READY
  2. Evidence is available (public or local accepted)
  3. Supply-chain enforcement remains active
`;

console.log(help.trim());
