/**
 * Control704 technician accounts (Node runtime only — uses node:crypto scrypt).
 *
 * CONTROL704_ACCOUNTS = JSON array, hashes only, never raw keys:
 *   [{"id":"jean","role":"admin","keyHash":"scrypt$16384$8$1$<saltB64url>$<hashB64url>"}]
 *
 * Generate a key + hash with:  node scripts/control704-hash-key.mjs <id> <role>
 */

import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import { isRole, type Role } from './roles';

export interface Account {
  id: string;
  role: Role;
  keyHash: string;
  disabled?: boolean;
}

const ID_RE = /^[a-z0-9][a-z0-9._-]{1,47}$/i;
const SCRYPT_KEYLEN = 32;

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function hashAccessKey(
  key: string,
  opts?: { N?: number; r?: number; p?: number; salt?: Buffer }
): string {
  const N = opts?.N ?? 16384;
  const r = opts?.r ?? 8;
  const p = opts?.p ?? 1;
  const salt = opts?.salt ?? randomBytes(16);
  const hash = scryptSync(key, salt, SCRYPT_KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', N, r, p, b64url(salt), b64url(hash)].join('$');
}

export function verifyAccessKey(key: string, stored: string): boolean {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (![N, r, p].every(n => Number.isInteger(n) && n > 0) || N > 1 << 20) return false;
    const salt = fromB64url(parts[4]);
    const expected = fromB64url(parts[5]);
    if (expected.length !== SCRYPT_KEYLEN) return false;
    const actual = scryptSync(String(key || ''), salt, SCRYPT_KEYLEN, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function generateAccessKey(): string {
  return `c704_${b64url(randomBytes(32))}`;
}

/** Load accounts from env. Invalid entries are skipped (never logged with hashes). */
export function loadAccounts(env: NodeJS.ProcessEnv = process.env): Account[] {
  const raw = (env.CONTROL704_ACCOUNTS || '').trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[control704] CONTROL704_ACCOUNTS is not valid JSON — no accounts loaded');
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Account[] = [];
  const seen = new Set<string>();
  for (const a of parsed as Array<Record<string, unknown>>) {
    const id = String(a?.id ?? '').trim();
    const role = a?.role;
    const keyHash = String(a?.keyHash ?? '');
    if (!ID_RE.test(id) || !isRole(role) || !keyHash.startsWith('scrypt$')) continue;
    if (seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());
    out.push({ id, role, keyHash, disabled: a?.disabled === true });
  }
  return out;
}

export function findAccount(id: string, env: NodeJS.ProcessEnv = process.env): Account | null {
  const want = String(id || '').trim().toLowerCase();
  if (!want) return null;
  return loadAccounts(env).find(a => a.id.toLowerCase() === want && !a.disabled) || null;
}

// Dummy hash so unknown ids cost the same scrypt work as known ones.
let dummyHash: string | null = null;

/** Authenticate id + key. Returns the account or null. */
export function authenticate(
  id: string,
  key: string,
  env: NodeJS.ProcessEnv = process.env
): Account | null {
  const acct = findAccount(id, env);
  if (!acct) {
    dummyHash ??= hashAccessKey('dummy-key-never-valid');
    verifyAccessKey(String(key || ''), dummyHash);
    return null;
  }
  return verifyAccessKey(String(key || ''), acct.keyHash) ? acct : null;
}
