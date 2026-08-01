#!/usr/bin/env node
/**
 * Sigstore Cosign — sign a container image
 *
 * Env:
 *   IMAGE_REF          required (e.g. living-intermediate-control-plane:0.4.7)
 *   COSIGN_YES=1       non-interactive keyless (CI)
 *   COSIGN_PRIVATE_KEY optional path for key-based signing
 *   COSIGN_PASSWORD    optional key password
 *   ALLOW_SKIP=1       skip if cosign missing
 *
 * Keyless (recommended in GitHub Actions with id-token: write):
 *   COSIGN_YES=1 cosign sign <image>
 *
 * Key-based:
 *   cosign sign --key cosign.key <image>
 */

import { spawnSync } from 'node:child_process';

const image = process.env.IMAGE_REF || process.argv[2];
const allowSkip = process.env.ALLOW_SKIP === '1' || process.env.ALLOW_SKIP === 'true';
const key = process.env.COSIGN_PRIVATE_KEY || '';

function hasCosign() {
  const r = spawnSync('cosign', ['version'], { encoding: 'utf8' });
  return r.status === 0 || (r.stdout || r.stderr || '').length > 0;
}

if (!image) {
  console.error('IMAGE_REF is required. Example: IMAGE_REF=myimage:tag npm run cosign:sign');
  process.exit(1);
}

if (!hasCosign()) {
  if (allowSkip) {
    console.log(JSON.stringify({ ok: true, skipped: true, detail: 'cosign not installed' }, null, 2));
    process.exit(0);
  }
  console.error('cosign not installed. https://docs.sigstore.dev/cosign/system_config/installation/');
  process.exit(1);
}

const args = ['sign'];
if (key) {
  args.push('--key', key);
} else {
  // Keyless / ambient OIDC when available
  args.push('--yes');
}
args.push(image);

process.stdout.write(`$ cosign ${args.join(' ')}\n`);
const r = spawnSync('cosign', args, { stdio: 'inherit', env: process.env });

const result = {
  timestamp: new Date().toISOString(),
  ok: r.status === 0,
  image,
  mode: key ? 'key' : 'keyless',
  note: r.status === 0
    ? 'Image signed with Cosign.'
    : 'Cosign sign failed. For local keyless you may need an identity provider; use a key or CI OIDC.'
};

console.log(JSON.stringify(result, null, 2));
process.exit(r.status === 0 ? 0 : 1);
