#!/usr/bin/env node
/**
 * Search / inspect the Rekor transparency log
 *
 * Requires `rekor-cli` OR uses `cosign tree` / documentation fallback.
 *
 * Env:
 *   REKOR_ARTIFACT_HASH  sha256 hash to search (optional)
 *   REKOR_UUID           entry UUID to fetch (optional)
 *   REKOR_SERVER_URL     default https://rekor.sigstore.dev
 *   IMAGE_REF            optional — prints guidance for image-linked entries
 *   ALLOW_SKIP=1
 *
 * Examples:
 *   REKOR_UUID=... npm run rekor:get
 *   REKOR_ARTIFACT_HASH=sha256:... npm run rekor:search
 */

import { spawnSync } from 'node:child_process';

const allowSkip = process.env.ALLOW_SKIP === '1' || process.env.ALLOW_SKIP === 'true';
const uuid = process.env.REKOR_UUID || process.argv[2] || '';
const hash = process.env.REKOR_ARTIFACT_HASH || '';
const rekorUrl = process.env.REKOR_SERVER_URL || 'https://rekor.sigstore.dev';
const image = process.env.IMAGE_REF || '';

function hasCmd(cmd) {
  const r = spawnSync(cmd, ['version'], { encoding: 'utf8' });
  // rekor-cli uses `rekor-cli version`
  if (r.status === 0) return true;
  const r2 = spawnSync(cmd, ['--help'], { encoding: 'utf8' });
  return (r2.stdout || r2.stderr || '').length > 0;
}

if (!hasCmd('rekor-cli')) {
  if (allowSkip) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      detail: 'rekor-cli not installed',
      rekorUrl,
      hint: 'Install rekor-cli: https://docs.sigstore.dev/logging/overview/'
    }, null, 2));
    process.exit(0);
  }
  console.error('rekor-cli not installed. https://github.com/sigstore/rekor/releases');
  process.exit(1);
}

const results = [];
let failed = 0;

if (uuid) {
  const args = ['get', '--uuid', uuid, '--rekor_server', rekorUrl];
  process.stdout.write(`$ rekor-cli ${args.join(' ')}\n`);
  const r = spawnSync('rekor-cli', args, { stdio: 'inherit' });
  results.push({ step: 'get', uuid, ok: r.status === 0 });
  if (r.status !== 0) failed++;
}

if (hash) {
  const args = ['search', '--sha', hash.replace(/^sha256:/, ''), '--rekor_server', rekorUrl];
  process.stdout.write(`$ rekor-cli ${args.join(' ')}\n`);
  const r = spawnSync('rekor-cli', args, { stdio: 'inherit' });
  results.push({ step: 'search', hash, ok: r.status === 0 });
  if (r.status !== 0) failed++;
}

if (!uuid && !hash) {
  console.log(JSON.stringify({
    ok: true,
    rekorUrl,
    image: image || null,
    note: 'Provide REKOR_UUID or REKOR_ARTIFACT_HASH to query the log.',
    examples: [
      'REKOR_UUID=<uuid> npm run rekor:get',
      'REKOR_ARTIFACT_HASH=sha256:... npm run rekor:search',
      'IMAGE_REF=my:tag npm run cosign:verify   # Cosign checks Rekor during verify'
    ]
  }, null, 2));
  process.exit(0);
}

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  ok: failed === 0,
  rekorUrl,
  results,
  note: failed === 0 ? 'Rekor query completed.' : 'Rekor query failed.'
}, null, 2));
process.exit(failed === 0 ? 0 : 1);
