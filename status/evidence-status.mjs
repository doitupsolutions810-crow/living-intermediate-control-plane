#!/usr/bin/env node
/**
 * Emit or verify a residual-aware evidence status document.
 *
 *   node status/evidence-status.mjs emit [--S 0.073] [--tau 0.84]
 *   node status/evidence-status.mjs verify <file.json>
 *
 * Signing requires EVIDENCE_SOURCE_PRIVATE_KEY_PEM + EVIDENCE_SOURCE_KEY_ID.
 * Verification requires EVIDENCE_SOURCE_PUBLIC_KEY_PEM + EVIDENCE_SOURCE_KEY_ID.
 * Without keys, emit produces unsigned docs; verify with --allow-unsigned for local only.
 */
import { readFileSync } from 'node:fs';
import {
  buildEvidenceStatusDocument,
  sealEvidenceStatusDocument,
  verifyEvidenceStatusDocument,
} from '../lib/evidence-status-document.mjs';
import { parseResidualCoordinate, parseTopologySaturation } from '../lib/residual-input.mjs';

const [,, cmd, ...rest] = process.argv;

function flag(name) {
  const i = rest.indexOf(name);
  if (i < 0) return undefined;
  return rest[i + 1] != null && !rest[i + 1].startsWith('--') ? rest[i + 1] : '';
}

if (cmd === 'emit') {
  const residualInput = parseResidualCoordinate(flag('--S') ?? undefined);
  const tauInput = parseTopologySaturation(flag('--tau') ?? undefined);
  if (!residualInput.valid || !tauInput.valid) {
    console.error(!residualInput.valid ? residualInput.error : tauInput.error);
    process.exit(2);
  }
  const roleRaw = flag('--role');
  const roleBlock = roleRaw != null ? Number(roleRaw) : 4;
  if (roleRaw !== undefined && (roleRaw.trim() === '' || !Number.isInteger(roleBlock))) {
    console.error('--role must be an integer atlas block.');
    process.exit(2);
  }
  const doc = buildEvidenceStatusDocument({
    S: residualInput.value, tau: tauInput.value, roleBlock, authority: 'local'
  });
  const sealed = sealEvidenceStatusDocument(doc);
  console.log(JSON.stringify(sealed, null, 2));
  process.exit(0);
}

if (cmd === 'verify') {
  const file = rest.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: evidence-status.mjs verify <file.json> [--allow-unsigned]');
    process.exit(2);
  }
  const allowUnsigned = rest.includes('--allow-unsigned');
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const result = verifyEvidenceStatusDocument(doc, { requireSignature: !allowUnsigned });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}

console.error('Usage: evidence-status.mjs [emit|verify] ...');
process.exit(2);
