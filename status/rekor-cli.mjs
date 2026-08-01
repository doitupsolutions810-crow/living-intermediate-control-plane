#!/usr/bin/env node
/**
 * Integrated rekor-cli command runner
 *
 * Usage:
 *   node status/rekor-cli.mjs <subcommand> [args...]
 *   npm run rekor -- version
 *   npm run rekor -- search --sha <hash>
 *   npm run rekor -- get --uuid <uuid>
 *   plane rekor version
 *
 * Env:
 *   REKOR_SERVER_URL   default https://rekor.sigstore.dev
 *   REKOR_UUID         used when subcommand is get and no --uuid passed
 *   REKOR_ARTIFACT_HASH  used when subcommand is search and no --sha passed
 *   ALLOW_SKIP=1       exit 0 if rekor-cli missing
 */

import { spawnSync } from 'node:child_process';

const allowSkip = process.env.ALLOW_SKIP === '1' || process.env.ALLOW_SKIP === 'true';
const rekorUrl = process.env.REKOR_SERVER_URL || 'https://rekor.sigstore.dev';
const argv = process.argv.slice(2);
let sub = argv[0] || 'help';
let rest = argv.slice(1);

function hasRekorCli() {
  const r = spawnSync('rekor-cli', ['version'], { encoding: 'utf8' });
  if (r.status === 0) return true;
  const r2 = spawnSync('rekor-cli', ['--help'], { encoding: 'utf8' });
  return (r2.stdout || r2.stderr || '').length > 0;
}

if (sub === 'help' || sub === '--help' || sub === '-h') {
  console.log(`rekor-cli integration

Install: see docs/cosign.md (Homebrew, curl, Go, Windows)

Commands:
  npm run rekor -- version
  npm run rekor -- search --sha <hex>
  npm run rekor -- get --uuid <uuid>
  npm run rekor -- verify --type hashedrekord --artifact <file>  (if supported by your rekor-cli)

Env helpers:
  REKOR_ARTIFACT_HASH=sha256:... npm run rekor -- search
  REKOR_UUID=... npm run rekor -- get
  REKOR_SERVER_URL=https://rekor.sigstore.dev

Plane CLI:
  plane rekor version
  plane rekor search
  plane rekor get
`);
  process.exit(0);
}

if (!hasRekorCli()) {
  if (allowSkip) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      detail: 'rekor-cli not installed',
      install: {
        homebrew: 'brew install rekor-cli',
        docs: 'docs/cosign.md'
      }
    }, null, 2));
    process.exit(0);
  }
  console.error('rekor-cli not installed.');
  console.error('  Homebrew: brew install rekor-cli');
  console.error('  More:     docs/cosign.md');
  process.exit(1);
}

// Convenience: inject server + env-based flags
const args = [];

if (sub === 'search') {
  args.push('search');
  const hasSha = rest.some(a => a === '--sha' || a === '--hash');
  if (!hasSha && process.env.REKOR_ARTIFACT_HASH) {
    const h = process.env.REKOR_ARTIFACT_HASH.replace(/^sha256:/, '');
    args.push('--sha', h);
  }
  args.push(...rest);
  if (!args.includes('--rekor_server') && !args.includes('--rekor-server')) {
    args.push('--rekor_server', rekorUrl);
  }
} else if (sub === 'get') {
  args.push('get');
  const hasUuid = rest.some(a => a === '--uuid');
  if (!hasUuid && process.env.REKOR_UUID) {
    args.push('--uuid', process.env.REKOR_UUID);
  }
  args.push(...rest);
  if (!args.includes('--rekor_server') && !args.includes('--rekor-server')) {
    args.push('--rekor_server', rekorUrl);
  }
} else if (sub === 'version') {
  args.push('version');
} else {
  // Pass through any other rekor-cli subcommand
  args.push(sub, ...rest);
  if (!args.includes('--rekor_server') && !args.includes('--rekor-server') && sub !== 'version' && sub !== 'help') {
    // only add for server-talking commands when not already present
    if (['search', 'get', 'upload', 'verify'].includes(sub)) {
      args.push('--rekor_server', rekorUrl);
    }
  }
}

process.stdout.write(`$ rekor-cli ${args.join(' ')}\n`);
const r = spawnSync('rekor-cli', args, { stdio: 'inherit', env: process.env });

const result = {
  timestamp: new Date().toISOString(),
  ok: r.status === 0,
  command: args,
  rekorUrl,
  note: r.status === 0 ? 'rekor-cli command completed.' : 'rekor-cli command failed.'
};
console.log(JSON.stringify(result, null, 2));
process.exit(r.status === 0 ? 0 : 1);
