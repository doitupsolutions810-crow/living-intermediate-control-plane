/**
 * Control704 dataset code override — admin-only break-glass.
 *
 * An override sets one dotted key inside a named dataset/config to a JSON value,
 * with a required reason and optional expiry. It never touches authentication:
 * callers must already hold a verified admin session, and every preview,
 * apply, denial, and revert is written to the append-only audit log.
 *
 * Datasets:
 *   CONTROL704_DATASETS  JSON object of base datasets, e.g. {"x":{"mode":"normal"},"y":{},"z":{}}
 *                        Unset → three empty datasets x, y, z (one per proxy target).
 *   CONTROL704_OVERRIDE_PATH  state file (default /tmp/control704-overrides.json, best-effort on serverless)
 */

import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { appendAudit } from './audit';
import type { Role } from './roles';

export const MIN_REASON = 10;
export const MAX_REASON = 500;
export const MAX_VALUE_BYTES = 16 * 1024;
export const MAX_TTL_MS = 30 * 24 * 3600 * 1000;

const KEY_RE = /^[A-Za-z0-9_-]{1,64}(\.[A-Za-z0-9_-]{1,64}){0,9}$/;
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface OverrideRecord {
  id: string;
  dataset: string;
  key: string;
  value: Json;
  previous: Json | undefined;
  reason: string;
  actor: string;
  createdAt: string;
  expiresAt: string | null;
  revertedAt?: string;
  revertedBy?: string;
}

export interface OverrideRequest {
  dataset: string;
  key: string;
  value: unknown;
  reason: string;
  expiresAt?: string | null;
  ttlMinutes?: number | null;
  dryRun?: boolean;
  confirm?: boolean;
}

export interface OverrideActor {
  sub: string;
  role: Role;
}

export type OverrideOutcome =
  | { ok: true; mode: 'dry_run'; diff: Diff; note: string }
  | { ok: true; mode: 'applied'; diff: Diff; record: OverrideRecord }
  | { ok: false; status: number; error: string; detail?: string };

export interface Diff {
  dataset: string;
  key: string;
  before: Json | undefined;
  after: Json;
  expiresAt: string | null;
}

let state: OverrideRecord[] | null = null;

function statePath(): string {
  return (process.env.CONTROL704_OVERRIDE_PATH || '').trim() || '/tmp/control704-overrides.json';
}

function loadState(): OverrideRecord[] {
  if (state) return state;
  state = [];
  try {
    const p = statePath();
    if (existsSync(p)) {
      const parsed = JSON.parse(readFileSync(p, 'utf8'));
      if (Array.isArray(parsed)) state = parsed as OverrideRecord[];
    }
  } catch {
    state = [];
  }
  return state;
}

function saveState(): void {
  try {
    const p = statePath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(loadState(), null, 2), 'utf8');
  } catch {
    /* read-only FS — in-memory state still applies on this instance */
  }
}

export function baseDatasets(env: NodeJS.ProcessEnv = process.env): Record<string, Record<string, Json>> {
  const raw = (env.CONTROL704_DATASETS || '').trim();
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        const out: Record<string, Record<string, Json>> = {};
        for (const [k, v] of Object.entries(p)) {
          if (/^[A-Za-z0-9_-]{1,64}$/.test(k) && v && typeof v === 'object' && !Array.isArray(v)) {
            out[k] = v as Record<string, Json>;
          }
        }
        if (Object.keys(out).length) return out;
      }
    } catch {
      /* fall through to defaults */
    }
  }
  return { x: {}, y: {}, z: {} };
}

function clone<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

function getAt(obj: Record<string, Json>, key: string): Json | undefined {
  let cur: Json | undefined = obj;
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, part)) return undefined;
    cur = (cur as Record<string, Json>)[part];
  }
  return cur;
}

function setAt(obj: Record<string, Json>, key: string, value: Json): void {
  const parts = key.split('.');
  let cur: Record<string, Json> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (!next || typeof next !== 'object' || Array.isArray(next)) cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, Json>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function isActive(r: OverrideRecord, now = Date.now()): boolean {
  if (r.revertedAt) return false;
  return !r.expiresAt || Date.parse(r.expiresAt) > now;
}

export function activeOverrides(dataset?: string, now = Date.now()): OverrideRecord[] {
  return loadState().filter(r => isActive(r, now) && (!dataset || r.dataset === dataset));
}

/** Base dataset with all active overrides applied in order. */
export function effectiveDataset(name: string, now = Date.now()): Record<string, Json> | null {
  const base = baseDatasets()[name];
  if (!base) return null;
  const out = clone(base);
  for (const r of activeOverrides(name, now)) setAt(out, r.key, clone(r.value));
  return out;
}

function validate(req: OverrideRequest, now: number): { ok: true; value: Json; expiresAt: string | null } | { ok: false; error: string; detail?: string } {
  const datasets = baseDatasets();
  if (!req || typeof req !== 'object') return { ok: false, error: 'invalid_request' };
  if (!Object.prototype.hasOwnProperty.call(datasets, req.dataset)) {
    return { ok: false, error: 'unknown_dataset', detail: `allowed: ${Object.keys(datasets).join(', ')}` };
  }
  if (typeof req.key !== 'string' || !KEY_RE.test(req.key) || req.key.split('.').some(p => FORBIDDEN.has(p))) {
    return { ok: false, error: 'invalid_key', detail: 'dotted key of [A-Za-z0-9_-] segments, max depth 10' };
  }
  const reason = typeof req.reason === 'string' ? req.reason.trim() : '';
  if (reason.length < MIN_REASON || reason.length > MAX_REASON) {
    return { ok: false, error: 'reason_required', detail: `reason must be ${MIN_REASON}-${MAX_REASON} chars` };
  }
  if (req.value === undefined) return { ok: false, error: 'value_required' };
  let value: Json;
  try {
    const s = JSON.stringify(req.value);
    if (Buffer.byteLength(s) > MAX_VALUE_BYTES) return { ok: false, error: 'value_too_large' };
    value = JSON.parse(s);
  } catch {
    return { ok: false, error: 'value_not_json' };
  }
  let expiresAt: string | null = null;
  if (req.ttlMinutes != null) {
    const m = Number(req.ttlMinutes);
    if (!Number.isFinite(m) || m <= 0) return { ok: false, error: 'invalid_ttl' };
    expiresAt = new Date(now + Math.min(m * 60_000, MAX_TTL_MS)).toISOString();
  } else if (req.expiresAt) {
    const t = Date.parse(String(req.expiresAt));
    if (!Number.isFinite(t) || t <= now) return { ok: false, error: 'invalid_expiry', detail: 'expiresAt must be in the future' };
    if (t - now > MAX_TTL_MS) return { ok: false, error: 'invalid_expiry', detail: 'max 30 days' };
    expiresAt = new Date(t).toISOString();
  }
  return { ok: true, value, expiresAt };
}

/**
 * Preview (dryRun, default) or apply an override. Apply requires admin role
 * AND confirm === true. Never mutates auth state.
 */
export function submitOverride(req: OverrideRequest, actor: OverrideActor, now = Date.now()): OverrideOutcome {
  const dryRun = req?.dryRun !== false;
  const target = `${req?.dataset ?? '?'}:${req?.key ?? '?'}`;
  const reason = typeof req?.reason === 'string' ? req.reason.trim() : undefined;

  if (actor.role !== 'admin') {
    appendAudit({ actor: actor.sub, role: actor.role, action: 'override.denied', target, reason, outcome: 'denied', detail: { why: 'admin_required' } });
    return { ok: false, status: 403, error: 'admin_required' };
  }

  const v = validate(req, now);
  if (!v.ok) {
    appendAudit({ actor: actor.sub, role: actor.role, action: 'override.invalid', target, reason, outcome: 'denied', detail: { error: v.error } });
    return { ok: false, status: 400, error: v.error, detail: v.detail };
  }

  const current = effectiveDataset(req.dataset, now) || {};
  const diff: Diff = {
    dataset: req.dataset,
    key: req.key,
    before: clone(getAt(current, req.key)),
    after: v.value,
    expiresAt: v.expiresAt
  };

  if (dryRun) {
    appendAudit({ actor: actor.sub, role: actor.role, action: 'override.preview', target, reason, outcome: 'preview', detail: { before: diff.before ?? null, after: diff.after, expiresAt: diff.expiresAt } });
    return { ok: true, mode: 'dry_run', diff, note: 'Dry run only. Re-submit with dryRun:false and confirm:true to apply.' };
  }

  if (req.confirm !== true) {
    appendAudit({ actor: actor.sub, role: actor.role, action: 'override.denied', target, reason, outcome: 'denied', detail: { why: 'confirm_required' } });
    return { ok: false, status: 400, error: 'confirm_required', detail: 'set confirm:true to apply' };
  }

  const record: OverrideRecord = {
    id: randomUUID(),
    dataset: req.dataset,
    key: req.key,
    value: v.value,
    previous: diff.before,
    reason: reason as string,
    actor: actor.sub,
    createdAt: new Date(now).toISOString(),
    expiresAt: v.expiresAt
  };
  loadState().push(record);
  saveState();
  appendAudit({ actor: actor.sub, role: actor.role, action: 'override.apply', target, reason, outcome: 'ok', detail: { id: record.id, before: diff.before ?? null, after: diff.after, expiresAt: diff.expiresAt } });
  return { ok: true, mode: 'applied', diff, record };
}

/** Revert an active override (admin + reason). Audit keeps both events. */
export function revertOverride(id: string, reason: string, actor: OverrideActor, now = Date.now()): { ok: boolean; status: number; error?: string; record?: OverrideRecord } {
  const why = String(reason || '').trim();
  if (actor.role !== 'admin') {
    appendAudit({ actor: actor.sub, role: actor.role, action: 'override.denied', target: id, outcome: 'denied', detail: { why: 'admin_required', op: 'revert' } });
    return { ok: false, status: 403, error: 'admin_required' };
  }
  if (why.length < MIN_REASON) return { ok: false, status: 400, error: 'reason_required' };
  const rec = loadState().find(r => r.id === id);
  if (!rec || !isActive(rec, now)) return { ok: false, status: 404, error: 'not_found_or_inactive' };
  rec.revertedAt = new Date(now).toISOString();
  rec.revertedBy = actor.sub;
  saveState();
  appendAudit({ actor: actor.sub, role: actor.role, action: 'override.revert', target: `${rec.dataset}:${rec.key}`, reason: why, outcome: 'ok', detail: { id } });
  return { ok: true, status: 200, record: rec };
}

/** Test hook. */
export function _resetOverrideState(): void {
  state = null;
}
