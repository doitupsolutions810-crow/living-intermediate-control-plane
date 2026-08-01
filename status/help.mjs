#!/usr/bin/env node

const help = `
Living Intermediate Control Plane — operator commands

Setup
  npm run init

Daily
  npm run procure            Full check + local evidence
  npm run procure:gated      Same, but doctor must pass first
  npm run dry-run            Preview without recording
  npm run next               Recommended next commands from current state
  npm run snapshot           State + decisions + security files
  npm run doctor / health / info / security-summary / report / last

Control
  npm run pause / resume / state / log / export / actions

Background
  npm run continuous / watch

CI & containers
  npm run ci / smoke / test
  npm run docker:build / docker:doctor

Success criteria
  1. Readiness is READY
  2. Evidence is available (public or local accepted)
  3. Supply-chain enforcement remains active
`;

console.log(help.trim());
