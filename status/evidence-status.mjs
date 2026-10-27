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

const [,, cmd, ...rest] = process.argv;

function flag(name, fallback = null) {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] != null ? rest[i + 1] : fallback;
}

if (cmd === 'emit') {
  const S = Number(flag('--S', 0)) || 0;
  const tau = flag('--tau') != null ? Number(flag('--tau')) : null;
  const roleBlock = flag('--role') != null ? Number(flag('--role')) : 4;
  const doc = buildEvidenceStatusDocument({ S, tau, roleBlock, authority: 'local' });
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
