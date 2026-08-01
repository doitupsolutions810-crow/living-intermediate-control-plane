#!/usr/bin/env node

const help = `
Living Intermediate Control Plane — operator commands

Setup
  npm run init

Daily
  npm run next / procure / procure:gated / dry-run
  npm run doctor / health / snapshot / report / last

Security (Trivy + OPA)
  npm run security-scan              Trivy FS + Conftest policy
  IMAGE_REF=tag npm run security-scan  Also scan container image
  npm run security-summary           Posture overview

Control
  npm run pause / resume / state / log / export / actions

CI & containers
  npm run ci / smoke / test
  npm run docker:build / docker:doctor

Success criteria
  1. Readiness is READY
  2. Evidence is available (public or local accepted)
  3. Supply-chain enforcement remains active
`;

console.log(help.trim());
