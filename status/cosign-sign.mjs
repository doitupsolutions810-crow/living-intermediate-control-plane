#!/usr/bin/env node
/**
 * Sigstore Cosign sign + Rekor transparency log upload
 *
 * By default Cosign records the signature in the public Rekor log
 * (https://rekor.sigstore.dev) unless REKOR_UPLOAD=0.
 *
 * Env:
 *   IMAGE_REF            required
 *   COSIGN_PRIVATE_KEY   optional key path
 *   REKOR_UPLOAD=0       disable tlog upload
 *   REKOR_SERVER_URL     optional (default public Rekor)
 *   ALLOW_SKIP=1         skip if cosign missing
 */

import { spawnSync } from 'node:child_process';

const image = process.env.IMAGE_REF || process.argv[2];
const allowSkip = process.env.ALLOW_SKIP === '1' || process.env.ALLOW_SKIP === 'true';
const key = process.env.COSIGN_PRIVATE_KEY || '';
const rekorUpload = process.env.REKOR_UPLOAD !== '0' && process.env.REKOR_UPLOAD !== 'false';
const rekorUrl = process.env.REKOR_SERVER_URL || '';

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
  args.push('--yes');
}

// Explicit Rekor transparency log behavior
if (rekorUpload) {
  args.push('--tlog-upload=true');
} else {
  args.push('--tlog-upload=false');
}
if (rekorUrl) {
  args.push('--rekor-url', rekorUrl);
}

args.push(image);

process.stdout.write(`$ cosign ${args.join(' ')}\n`);
const r = spawnSync('cosign', args, { stdio: 'inherit', env: process.env });

const result = {
  timestamp: new Date().toISOString(),
  ok: r.status === 0,
  image,
  mode: key ? 'key' : 'keyless',
  rekor: {
    upload: rekorUpload,
    server: rekorUrl || 'https://rekor.sigstore.dev'
  },
  note: r.status === 0
    ? (rekorUpload
      ? 'Image signed; signature entry uploaded to Rekor transparency log when supported for this ref.'
      : 'Image signed without Rekor upload (REKOR_UPLOAD=0).')
    : 'Cosign sign failed. Registry-pushed digests work best with keyless + Rekor.'
};

console.log(JSON.stringify(result, null, 2));
process.exit(r.status === 0 ? 0 : 1);
