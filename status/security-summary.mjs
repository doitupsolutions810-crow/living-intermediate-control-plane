#!/usr/bin/env node
/**
 * Security & supply-chain summary
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadConfig } from '../lib/config.mjs';
import { readPlaneState } from './plane-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const config = loadConfig();
const planeState = readPlaneState();

function hasCmd(cmd, probeArgs = ['version']) {
  const r = spawnSync(cmd, probeArgs, { encoding: 'utf8' });
  return r.status === 0 || (r.stdout || r.stderr || '').length > 0;
}

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {}

const files = {
  trivyConfig: existsSync(join(root, 'trivy.yaml')),
  trivyIgnore: existsSync(join(root, '.trivyignore')),
  trivyPolicy: existsSync(join(root, 'policy/trivy-results.rego')),
  snykPolicy: existsSync(join(root, 'policy/snyk-results.rego')),
  dockerfile: existsSync(join(root, 'Dockerfile')),
  ciWorkflow: existsSync(join(root, '.github/workflows/plane-ci.yml')),
  gatekeeperDir: existsSync(join(root, 'k8s/gatekeeper')),
  planeCli: existsSync(join(root, 'bin/plane.mjs')),
  cosignSign: existsSync(join(root, 'status/cosign-sign.mjs')),
  rekorCli: existsSync(join(root, 'status/rekor-cli.mjs'))
};

const tools = {
  cosign: hasCmd('cosign'),
  rekorCli: hasCmd('rekor-cli'),
  trivy: hasCmd('trivy'),
  snyk: hasCmd('snyk'),
  conftest: hasCmd('conftest')
};

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  version,
  plane: {
    paused: planeState.paused,
    securityValue: config.securityValue,
    gateDoctorOnProcure: config.gateDoctorOnProcure === true
  },
  successCriteria: [
    '1. Readiness is READY',
    '2. Evidence is available (public or local accepted)',
    '3. Supply-chain enforcement remains active'
  ],
  supplyChain: {
    container: 'distroless nodejs nonroot runtime',
    builders: ['docker-buildx', 'kaniko'],
    vulnerabilityScan: 'Trivy FS/image + Snyk test/container',
    policy: 'OPA/Conftest on Trivy JSON and Snyk JSON',
    signing: 'Sigstore Cosign (keyless or key) with Rekor tlog upload',
    transparencyLog: 'Rekor (https://rekor.sigstore.dev)',
    kubernetesAdmission: 'OPA Gatekeeper templates under k8s/gatekeeper/',
    sbom: 'Syft SPDX + CycloneDX (Kaniko path)',
    provenance: 'SLSA-style in-toto statements + optional GitHub attestations',
    filesPresent: files,
    toolsInstalled: tools
  },
  operatorCommands: {
    daily: 'plane checklist && plane procure',
    securityScan: 'plane security-scan',
    sign: 'IMAGE_REF=... plane cosign-sign',
    verify: 'IMAGE_REF=... plane cosign-verify',
    rekor: 'plane rekor version',
    metrics: 'plane metrics'
  },
  docs: [
    'docs/security.md',
    'docs/cli.md',
    'docs/cosign.md',
    'docs/trivy.md',
    'docs/gatekeeper.md',
    'docs/slsa.md'
  ],
  note: 'CI is a helper. Readiness and doctor remain the authority for limited-technicality decisions.'
}, null, 2));
