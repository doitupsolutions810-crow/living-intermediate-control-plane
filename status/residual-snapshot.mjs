#!/usr/bin/env node
/**
 * Emit a Great Scale residual snapshot for status / attestation documents.
 * Usage: node status/residual-snapshot.mjs [--S 0.073] [--tau 0.84] [--role 4]
 */
import { residualSnapshot } from '../lib/great-scale-residual.mjs';
import { parseResidualCoordinate, parseTopologySaturation } from '../lib/residual-input.mjs';

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  return args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : '';
}

const residualInput = parseResidualCoordinate(flag('--S') ?? undefined);
const tauInput = parseTopologySaturation(flag('--tau') ?? undefined);
if (!residualInput.valid || !tauInput.valid) {
  console.error(!residualInput.valid ? residualInput.error : tauInput.error);
  process.exit(2);
}
const roleRaw = flag('--role');
const roleBlock = roleRaw != null ? Number(roleRaw) : null;
if (roleRaw !== undefined && (roleRaw.trim() === '' || !Number.isInteger(roleBlock))) {
  console.error('--role must be an integer atlas block.');
  process.exit(2);
}

const snap = residualSnapshot({ S: residualInput.value, tau: tauInput.value, roleBlock });
console.log(JSON.stringify(snap, null, 2));
