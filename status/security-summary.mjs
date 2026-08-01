#!/usr/bin/env node
/**
 * Security & supply-chain summary for operators
 * Plain-language overview of what the plane and CI enforce.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { readPlaneState } from './plane-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const config = loadConfig();
const planeState = readPlaneState();

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {}

const files = {
  trivyConfig: existsSync(join(root, 'trivy.yaml')),
  trivyIgnore: existsSync(join(root, '.trivyignore')),
  opaPolicy: existsSync(join(root, 'policy/trivy-results.rego')),
  dockerfile: existsSync(join(root, 'Dockerfile')),
  ciWorkflow: existsSync(join(root, '.github/workflows/plane-ci.yml'))
};

const summary = {
  timestamp: new Date().toISOString(),
  version,
  plane: {
    paused: planeState.paused,
    securityValue: config.securityValue
  },
  successCriteria: [
    '1. Readiness is READY',
    '2. Evidence is available (public or local accepted)',
    '3. Supply-chain enforcement remains active'
  ],
  supplyChain: {
    container: 'distroless nodejs nonroot runtime',
    builders: ['docker-buildx', 'kaniko'],
    vulnerabilityScan: 'Trivy FS + image (CRITICAL/HIGH)',
    policy: 'OPA/Conftest on Trivy JSON',
    sbom: 'Syft SPDX + CycloneDX (Kaniko path)',
    provenance: 'SLSA-style in-toto statements + optional GitHub attestations',
    filesPresent: files
  },
  operatorCommands: {
    daily: 'npm run procure',
    health: 'npm run doctor',
    localCi: 'npm run ci',
    image: 'npm run docker:build && npm run docker:doctor'
  },
  docs: [
    'docs/security.md',
    'docs/ci.md',
    'docs/docker.md',
    'docs/trivy.md',
    'docs/kaniko.md',
    'docs/slsa.md'
  ],
  note: 'CI is a helper. Readiness and doctor remain the authority for limited-technicality decisions.'
};

console.log(JSON.stringify(summary, null, 2));
