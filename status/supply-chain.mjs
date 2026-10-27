#!/usr/bin/env node
/**
 * Integrated supply-chain path
 *
 * 1. security-scan (Trivy + Snyk + OPA)
 * 2. optional Cosign verify when IMAGE_REF set
 * 3. posture summary bound to the source revision
 *
 * Authorization-grade runs must set ALLOW_SKIP=0, IMAGE_REF, and
 * SUPPLY_CHAIN_SIGN=1. The procurement bridge independently validates the
 * emitted report's freshness, revision, scan steps, and signature verification.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentRevision } from '../lib/supply-chain-runtime.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const outPath = join(dataDir, 'supply-chain-last.json');
const attestationBundlePath = join(dataDir, 'supply-chain-last.bundle.json');

const imageRef = process.env.IMAGE_REF || '';
const doSign = process.env.SUPPLY_CHAIN_SIGN === '1';
const allowSkip = process.env.ALLOW_SKIP !== '0' && process.env.ALLOW_SKIP !== 'false';

function run(name, script, env = {}) {
  process.stdout.write(`\n======== supply-chain: ${name} ========\n`);
  const r = spawnSync(process.execPath, [join(root, script)], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit'
  });
  return { name, ok: r.status === 0, status: r.status, imageRef: env.IMAGE_REF || null };
}

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const results = [];
let failed = 0;
const scanEnv = {
  ALLOW_SKIP: allowSkip ? '1' : '0',
  // These explicit values override inherited environment variables so an
  // operator cannot silently bypass required scanners in an authorization run.
  SKIP_TRIVY: '0',
  SKIP_SNYK: '0',
  SKIP_SNYK_CONTAINER: '0',
  SKIP_OPA: '0',
  ...(imageRef ? { IMAGE_REF: imageRef } : {})
};

const scan = run('security-scan', 'status/security-scan.mjs', scanEnv);
results.push(scan);
if (!scan.ok) failed++;

if (doSign && imageRef) {
  const sign = run('cosign-sign', 'status/cosign-sign.mjs', {
    IMAGE_REF: imageRef,
    ALLOW_SKIP: allowSkip ? '1' : '0'
  });
  results.push(sign);
  if (!sign.ok) failed++;
}

if (imageRef) {
  const verify = run('cosign-verify', 'status/cosign-verify.mjs', {
    IMAGE_REF: imageRef,
    ALLOW_SKIP: allowSkip ? '1' : '0'
  });
  results.push(verify);
  if (doSign && !verify.ok) failed++;
  else if (!doSign && !verify.ok) {
    results.push({
      name: 'cosign-verify-note',
      ok: true,
      detail: 'verify soft — set SUPPLY_CHAIN_SIGN=1 after push/sign for hard gate'
    });
  }
}

const summaryStep = run('security-summary', 'status/security-summary.mjs');
results.push(summaryStep);

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {}

const revision = currentRevision({ root, env: process.env });
const summary = {
  timestamp: new Date().toISOString(),
  revision: revision || null,
  version,
  ok: failed === 0,
  failed,
  allowSkip,
  imageRef: imageRef || null,
  signed: Boolean(doSign && imageRef),
  results,
  stack: {
    scan: 'Trivy FS/image + Snyk test/container',
    policy: 'OPA/Conftest (Trivy + Snyk JSON)',
    image: 'distroless nonroot',
    signing: 'Sigstore Cosign',
    transparencyLog: 'Rekor',
    provenance: 'SLSA-style + optional GitHub attestations',
    sbom: 'Syft (CI Kaniko path)'
  },
  next: imageRef
    ? ['plane admit-change', 'npm run ci']
    : ['npm run docker:build', 'IMAGE_REF=living-intermediate-control-plane:0.8.1 plane supply-chain'],
  note: failed === 0
    ? 'Supply-chain path completed; authorization still requires fresh revision-bound evidence and no skipped checks.'
    : 'Supply-chain path reported failures.'
};

writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
console.log('\n' + JSON.stringify(summary, null, 2));

// The JSON report is not trusted merely because it exists locally. Sign the
// exact bytes and require the caller to configure the identity/issuer that the
// procurement bridge will use for independent verification.
const attestationIdentity = (process.env.SUPPLY_CHAIN_ATTESTATION_IDENTITY || '').trim();
const attestationIssuer = (process.env.SUPPLY_CHAIN_ATTESTATION_ISSUER || '').trim();
let attestationOk = false;
if (!attestationIdentity || !attestationIssuer) {
  console.error('[supply-chain] SUPPLY_CHAIN_ATTESTATION_IDENTITY and SUPPLY_CHAIN_ATTESTATION_ISSUER are required for authorization-grade evidence.');
} else {
  const sign = spawnSync('cosign', [
    'sign-blob', '--yes', '--bundle', attestationBundlePath, outPath
  ], { cwd: root, stdio: 'inherit', env: process.env });
  attestationOk = sign.status === 0 && existsSync(attestationBundlePath);
  if (!attestationOk) console.error('[supply-chain] report attestation signing failed; report cannot authorize procurement.');
}
process.exit(failed === 0 && attestationOk ? 0 : 1);
