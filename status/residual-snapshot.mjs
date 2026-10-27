#!/usr/bin/env node
/**
 * Emit a Great Scale residual snapshot for status / attestation documents.
 * Usage: node status/residual-snapshot.mjs [--S 0.073] [--tau 0.84] [--role 4]
 */
import { residualSnapshot, atlasRole } from '../lib/great-scale-residual.mjs';

const args = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
}

const S = Number(flag('--S', 0));
const tau = flag('--tau') != null ? Number(flag('--tau')) : null;
const roleBlock = flag('--role') != null ? Number(flag('--role')) : null;

const snap = residualSnapshot({ S, tau, roleBlock });
console.log(JSON.stringify(snap, null, 2));
