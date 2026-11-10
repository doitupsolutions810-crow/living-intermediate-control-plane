/**
 * Control704 append-only audit log (Node runtime).
 *
 * - Every entry is hash-chained: hash = sha256(prevHash + canonical JSON), so
 *   edits or deletions are detectable with verifyAuditChain().
 * - Written to an append-only JSONL file (CONTROL704_AUDIT_PATH, default
 *   /tmp/control704-audit.jsonl) and mirrored to stdout with the prefix
 *   "[control704-audit]" so Vercel runtime logs keep a copy even when /tmp is
 *   lost on a cold start.
 * - There is intentionally no update/delete API.
 * - Never put secrets in `detail`; values are clipped.
 */

import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type AuditOutcome = 'ok' | 'denied' | 'error' | 'preview';

export interface AuditInput {
  actor: string;
  role: string;
  action: string;
  target?: string;
  reason?: string;
  outcome: AuditOutcome;
  detail?: Record<string, unknown>;
}

export interface AuditEntry extends AuditInput {
  seq: number;
  ts: string;
  prevHash: string;
  hash: string;
}

const GENESIS = '0'.repeat(64);
const MAX_MEMORY = 500;
const MAX_DETAIL_CHARS = 4000;

let entries: AuditEntry[] | null = null;

function auditPath(): string {
  return (process.env.CONTROL704_AUDIT_PATH || '').trim() || '/tmp/control704-audit.jsonl';
}

function canonical(e: Omit<AuditEntry, 'hash'>): string {
  return JSON.stringify({
    seq: e.seq,
    ts: e.ts,
    actor: e.actor,
    role: e.role,
    action: e.action,
    target: e.target ?? null,
    reason: e.reason ?? null,
    outcome: e.outcome,
    detail: e.detail ?? null,
    prevHash: e.prevHash
  });
}

function computeHash(e: Omit<AuditEntry, 'hash'>): string {
  return createHash('sha256').update(e.prevHash).update(canonical(e)).digest('hex');
}

function clipDetail(d?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!d) return undefined;
  const s = JSON.stringify(d);
  if (s.length <= MAX_DETAIL_CHARS) return JSON.parse(s);
  return { truncated: true, preview: s.slice(0, MAX_DETAIL_CHARS) };
}

function load(): AuditEntry[] {
  if (entries) return entries;
  const list: AuditEntry[] = [];
  const p = auditPath();
  try {
    if (existsSync(p)) {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          list.push(JSON.parse(line) as AuditEntry);
        } catch {
          /* skip corrupt line; verifyAuditChain will flag the gap */
        }
      }
    }
  } catch {
    /* unreadable — start a fresh in-memory chain */
  }
  entries = list.length > MAX_MEMORY ? list.slice(-MAX_MEMORY) : list;
  return entries;
}

export function appendAudit(input: AuditInput): AuditEntry {
  const list = load();
  const prev = list[list.length - 1];
  const base: Omit<AuditEntry, 'hash'> = {
    seq: prev ? prev.seq + 1 : 1,
    ts: new Date().toISOString(),
    actor: String(input.actor || 'anonymous').slice(0, 64),
    role: String(input.role || 'none').slice(0, 16),
    action: String(input.action).slice(0, 64),
    target: input.target ? String(input.target).slice(0, 200) : undefined,
    reason: input.reason ? String(input.reason).slice(0, 500) : undefined,
    outcome: input.outcome,
    detail: clipDetail(input.detail),
    prevHash: prev ? prev.hash : GENESIS
  };
  const entry: AuditEntry = { ...base, hash: computeHash(base) };
  list.push(entry);
  if (list.length > MAX_MEMORY) list.splice(0, list.length - MAX_MEMORY);

  const line = JSON.stringify(entry);
  try {
    const p = auditPath();
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, line + '\n', { encoding: 'utf8', flag: 'a' });
  } catch {
    /* read-only FS — stdout copy below is still kept in platform logs */
  }
  console.log('[control704-audit] ' + line);
  return entry;
}

/** Most recent entries, newest first. */
export function listAudit(limit = 25): AuditEntry[] {
  const n = Math.max(1, Math.min(200, Math.floor(limit) || 25));
  return load().slice(-n).reverse();
}

/** Verify the in-memory chain (oldest to newest). */
export function verifyAuditChain(): { ok: boolean; checked: number; brokenAt?: number } {
  const list = load();
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const { hash, ...rest } = e;
    if (computeHash(rest) !== hash) return { ok: false, checked: i, brokenAt: e.seq };
    if (i > 0 && e.prevHash !== list[i - 1].hash) return { ok: false, checked: i, brokenAt: e.seq };
  }
  return { ok: true, checked: list.length };
}

/** Test hook: drop the in-memory cache so the next call reloads from disk. */
export function _resetAuditCache(): void {
  entries = null;
}
