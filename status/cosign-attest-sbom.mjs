#!/usr/bin/env node
/**
 * Attach/attest SBOM with Cosign (Sigstore)
 *
 * Env:
 *   IMAGE_REF     required (image ref or registry digest)
 *   SBOM_PATH     path to SBOM file (spdx-json or cyclonedx-json)
 *   SBOM_PREDICATE_TYPE  default https://spdx.dev/Document
 *   ALLOW_SKIP=1  exit 0 if cosign/syft missing
 *
 * If SBOM_PATH is unset and `syft` is installed, generates data/sbom.spdx.json first.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const allowSkip = process.env.ALLOW_SKIP === '1' || process.env.ALLOW_SKIP === 'true';
const imageRef = process.env.IMAGE_REF || '';
let sbomPath = process.env.SBOM_PATH || '';
const predicateType = process.env.SBOM_PREDICATE_TYPE || 'https://spdx.dev/Document';

function hasCmd(cmd) {
  const r = spawnSync(cmd, ['version'], { encoding: 'utf8' });
  if (r.status === 0) return true;
  const r2 = spawnSync(cmd, ['--help'], { encoding: 'utf8' });
  return (r2.stdout || r2.stderr || '').length > 0;
}

if (!imageRef) {
  console.error('IMAGE_REF is required');
  process.exit(allowSkip ? 0 : 1);
}

if (!hasCmd('cosign')) {
  console.error('cosign not installed');
  process.exit(allowSkip ? 0 : 1);
}

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

if (!sbomPath) {
  const gen = join(dataDir, 'sbom.spdx.json');
  if (hasCmd('syft')) {
    process.stdout.write(`$ syft ${imageRef} -o spdx-json=${gen}\n`);
    const s = spawnSync('syft', [imageRef, '-o', `spdx-json=${gen}`], {
      cwd: root,
      stdio: 'inherit'
    });
    if (s.status === 0 && existsSync(gen)) sbomPath = gen;
  }
}

if (!sbomPath || !existsSync(sbomPath)) {
  console.error('No SBOM_PATH and could not generate via syft');
  console.error('Install syft or set SBOM_PATH=/path/to/sbom.json');
  process.exit(allowSkip ? 0 : 1);
}

// Prefer attest with predicate file; falls back to attach SBOM
const attestArgs = [
  'attest',
  '--yes',
  '--predicate', sbomPath,
  '--type', predicateType,
  imageRef
];
process.stdout.write(`$ cosign ${attestArgs.join(' ')}\n`);
let r = spawnSync('cosign', attestArgs, { cwd: root, stdio: 'inherit' });

if (r.status !== 0) {
  const attachArgs = ['attach', 'sbom', '--sbom', sbomPath, imageRef];
  process.stdout.write(`$ cosign ${attachArgs.join(' ')}\n`);
  r = spawnSync('cosign', attachArgs, { cwd: root, stdio: 'inherit' });
}

const summary = {
  timestamp: new Date().toISOString(),
  ok: r.status === 0,
  imageRef,
  sbomPath,
  predicateType,
  note: r.status === 0
    ? 'SBOM attested/attached via Cosign.'
    : 'Cosign attest/attach failed (registry auth or keyless ambient identity may be required).'
};
console.log(JSON.stringify(summary, null, 2));
process.exit(r.status === 0 ? 0 : 1);
