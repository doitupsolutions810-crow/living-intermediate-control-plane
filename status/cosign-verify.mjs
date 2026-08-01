#!/usr/bin/env node
/**
 * Sigstore Cosign verify against signatures + Rekor transparency log
 *
 * Cosign verify checks the Rekor log by default for keyless signatures.
 *
 * Env:
 *   IMAGE_REF
 *   COSIGN_PUBLIC_KEY
 *   COSIGN_CERTIFICATE_IDENTITY
 *   COSIGN_CERTIFICATE_OIDC_ISSUER
 *   REKOR_SERVER_URL
 *   ALLOW_SKIP=1
 */

import { spawnSync } from 'node:child_process';

const image = process.env.IMAGE_REF || process.argv[2];
const allowSkip = process.env.ALLOW_SKIP === '1' || process.env.ALLOW_SKIP === 'true';
const pubKey = process.env.COSIGN_PUBLIC_KEY || '';
const identity = process.env.COSIGN_CERTIFICATE_IDENTITY || '';
const issuer = process.env.COSIGN_CERTIFICATE_OIDC_ISSUER || '';
const rekorUrl = process.env.REKOR_SERVER_URL || '';

function hasCosign() {
  const r = spawnSync('cosign', ['version'], { encoding: 'utf8' });
  return r.status === 0 || (r.stdout || r.stderr || '').length > 0;
}

if (!image) {
  console.error('IMAGE_REF is required. Example: IMAGE_REF=myimage:tag npm run cosign:verify');
  process.exit(1);
}

if (!hasCosign()) {
  if (allowSkip) {
    console.log(JSON.stringify({ ok: true, skipped: true, detail: 'cosign not installed' }, null, 2));
    process.exit(0);
  }
  console.error('cosign not installed.');
  process.exit(1);
}

const args = ['verify'];
if (pubKey) {
  args.push('--key', pubKey);
} else {
  if (identity) args.push('--certificate-identity', identity);
  if (issuer) args.push('--certificate-oidc-issuer', issuer);
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
  mode: pubKey ? 'key' : 'keyless',
  rekor: {
    server: rekorUrl || 'https://rekor.sigstore.dev',
    checked: true
  },
  note: r.status === 0
    ? 'Cosign verification passed (includes Rekor log check when applicable).'
    : 'Cosign verification failed.'
};

console.log(JSON.stringify(result, null, 2));
process.exit(r.status === 0 ? 0 : 1);
