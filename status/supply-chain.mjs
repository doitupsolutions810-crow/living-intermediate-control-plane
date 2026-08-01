#!/usr/bin/env node
/**
 * Integrated supply-chain path
 *
 * 1. security-scan (Trivy + Snyk + OPA)
 * 2. optional Cosign verify when IMAGE_REF set
 * 3. posture summary
 *
 * Env:
 *   IMAGE_REF          enable image/container scans + optional cosign verify
 *   SUPPLY_CHAIN_SIGN=1  also attempt cosign sign (needs cosign + suitable ref)
 *   ALLOW_SKIP=1         soft-skip missing tools (default 1)
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const outPath = join(dataDir, 'supply-chain-last.json');

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
  return { name, ok: r.status === 0, status: r.status };
}

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const results = [];
let failed = 0;

const scanEnv = {
  ALLOW_SKIP: allowSkip ? '1' : '0',
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
  // verify may fail if never signed — count only when SIGN was requested
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
// summary is informational

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {}

const summary = {
  timestamp: new Date().toISOString(),
  version,
  ok: failed === 0,
  failed,
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
    ? 'Supply-chain integration path completed.'
    : 'Supply-chain path reported failures.'
};

writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
console.log('\n' + JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
