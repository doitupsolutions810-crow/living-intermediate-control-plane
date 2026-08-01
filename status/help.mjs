#!/usr/bin/env node

const help = `
Living Intermediate Control Plane — operator commands

Daily
  npm run next / procure / procure:gated / dry-run
  npm run doctor / health / snapshot / report / metrics / last

Security
  npm run security-scan       Trivy + Snyk + OPA (Trivy & Snyk Rego)
  npm run security-summary    Posture overview

Control
  npm run pause / resume / state / log / export / actions

CI & containers
  npm run ci / smoke / test / docker:build / docker:doctor

Success criteria
  1. Readiness is READY
  2. Evidence is available (public or local accepted)
  3. Supply-chain enforcement remains active
`;

console.log(help.trim());
