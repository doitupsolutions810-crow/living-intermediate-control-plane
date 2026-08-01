/**
 * Chat authorization sessions — external/agent work requires an active session.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export function sessionPath(root) {
  return join(root, 'data', 'agent-session.json');
}

export function readSession(root) {
  const p = sessionPath(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function isAuthorized(root) {
  const s = readSession(root);
  if (!s || !s.token || !s.expiresAt) return false;
  if (Date.now() > Date.parse(s.expiresAt)) return false;
  return true;
}

export function authorize(root, { minutes = 60, source = 'chat' } = {}) {
  const dataDir = join(root, 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const session = {
    token: randomBytes(16).toString('hex'),
    source,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    note: 'Authorized via chat interface. Allowlisted toolkit actions need no per-step approval until expiry.'
  };
  writeFileSync(sessionPath(root), JSON.stringify(session, null, 2) + '\n');
  return session;
}

export function revoke(root) {
  const p = sessionPath(root);
  if (existsSync(p)) unlinkSync(p);
  return { ok: true, revoked: true };
}
