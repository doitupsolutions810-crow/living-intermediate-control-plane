#!/usr/bin/env node
/**
 * Sigstore Cosign — verify a container image signature
 *
 * Env:
 *   IMAGE_REF             required
 *   COSIGN_PUBLIC_KEY     optional path for key-based verify
 *   COSIGN_CERTIFICATE_IDENTITY  optional (keyless)
 *   COSIGN_CERTIFICATE_OIDC_ISSUER optional (keyless)
 *   ALLOW_SKIP=1          skip if cosign missing
 */

import { spawnSync } from 'node:child_process';

const image = process.env.IMAGE_REF || process.argv[2];
const allowSkip = process.env.ALLOW_SKIP === '1' || process.env.ALLOW_SKIP === 'true';
const pubKey = process.env.COSIGN_PUBLIC_KEY || '';
const identity = process.env.COSIGN_CERTIFICATE_IDENTITY || '';
const issuer = process.env.COSIGN_CERTIFICATE_OIDC_ISSUER || '';

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
  // If neither key nor identity set, still attempt verify (works for some registries / attestations)
}
args.push(image);

process.stdout.write(`$ cosign ${args.join(' ')}\n`);
const r = spawnSync('cosign', args, { stdio: 'inherit', env: process.env });

const result = {
  timestamp: new Date().toISOString(),
  ok: r.status === 0,
  image,
  mode: pubKey ? 'key' : 'keyless',
  note: r.status === 0 ? 'Cosign verification passed.' : 'Cosign verification failed.'
};

console.log(JSON.stringify(result, null, 2));
process.exit(r.status === 0 ? 0 : 1);
