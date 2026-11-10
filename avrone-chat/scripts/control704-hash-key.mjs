#!/usr/bin/env node
/**
 * Issue a Control704 technician access key.
 *
 *   node scripts/control704-hash-key.mjs <id> <viewer|technician|admin> [--key-out <file>] [--merge '<existing CONTROL704_ACCOUNTS json>']
 *
 * Prints the account entry (scrypt hash only) as JSON for CONTROL704_ACCOUNTS.
 * The raw key is written to --key-out (mode 600) when given, otherwise printed
 * ONCE on stderr. Hand it to the technician over a private channel; it cannot be recovered.
 * Format matches lib/control704/accounts.ts (scrypt N=16384 r=8 p=1, 32-byte key).
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const [, , id, role, ...rest] = process.argv;
const ROLES = ['viewer', 'technician', 'admin'];
if (!id || !/^[a-z0-9][a-z0-9._-]{1,47}$/i.test(id) || !ROLES.includes(role)) {
  console.error('usage: control704-hash-key.mjs <id> <viewer|technician|admin> [--key-out file] [--merge json]');
  process.exit(2);
}
const opt = name => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const key = `c704_${b64url(randomBytes(32))}`;
const salt = randomBytes(16);
const hash = scryptSync(key, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const entry = { id, role, keyHash: ['scrypt', 16384, 8, 1, b64url(salt), b64url(hash)].join('$') };

let accounts = [entry];
const merge = opt('--merge');
if (merge) {
  const existing = JSON.parse(merge).filter(a => a.id.toLowerCase() !== id.toLowerCase());
  accounts = [...existing, entry];
}
const keyOut = opt('--key-out');
if (keyOut) {
  writeFileSync(keyOut, key + '\n', { mode: 0o600 });
  console.error(`raw key written to ${keyOut}`);
} else {
  console.error(`ACCESS KEY for ${id} (shown once): ${key}`);
}
console.log(JSON.stringify(accounts));
