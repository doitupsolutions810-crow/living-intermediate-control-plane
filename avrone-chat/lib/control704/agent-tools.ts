/**
 * Control704 LangGraph tools: proxy_x, proxy_y, proxy_z, control704_targets,
 * dataset_override. Only built when the chat request carries a verified
 * Control704 session; every call is re-gated on that caller's role.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { scrubSecrets } from '../scrub';
import type { ToolActivity } from '../agent-tools';
import { proxyRequest } from './proxy';
import { submitOverride } from './override';
import { describeTarget, loadTargets, TARGET_IDS, type TargetId } from './targets';
import type { Role } from './roles';

export interface ToolCaller {
  sub: string;
  role: Role;
}

type Sink = ((a: ToolActivity) => void) | undefined;

const MAX_TOOL_TEXT = 8000;

function report(sink: Sink, name: string, ok: boolean, summary: string, started: number) {
  sink?.({ name, ok, summary, ms: Date.now() - started });
}

export function buildControl704Tools(caller: ToolCaller | null | undefined, onActivity?: Sink) {
  if (!caller) return [];

  const proxyTools = TARGET_IDS.map((id: TargetId) =>
    tool(
      async ({ method, path, query, body }) => {
        const started = Date.now();
        const segments = String(path || '/')
          .split('?')[0]
          .split('/')
          .filter(Boolean);
        const r = await proxyRequest({
          target: id,
          method: method || 'GET',
          segments,
          search: query ? `?${String(query).replace(/^\?/, '')}` : '',
          headers: body ? { 'content-type': 'application/json', accept: 'application/json' } : { accept: 'application/json' },
          body: body ?? null,
          actor: caller,
          via: 'agent'
        });
        const text = scrubSecrets(new TextDecoder().decode(r.body), MAX_TOOL_TEXT);
        report(onActivity, `proxy_${id}`, r.status < 400, `proxy_${id} ${method || 'GET'} ${path || '/'} → ${r.status}`, started);
        return JSON.stringify({ target: id, status: r.status, error: r.error, body: text });
      },
      {
        name: `proxy_${id}`,
        description:
          `Call Control704 proxy target ${id.toUpperCase()} through the authenticated access layer as the signed-in technician (${caller.sub}, role ${caller.role}). ` +
          'Upstream host is fixed server-side; only path/query/body are yours. Method/path limited by role. Returns status and body.',
        schema: z.object({
          method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().describe('HTTP method (default GET)'),
          path: z.string().max(1000).describe('Path under the target, e.g. /status'),
          query: z.string().max(2000).optional().describe('Optional query string without "?"'),
          body: z.string().max(64000).optional().describe('Optional JSON request body as a string')
        })
      }
    )
  );

  const targets = tool(
    async () => {
      const started = Date.now();
      const list = loadTargets().map(t => describeTarget(t, caller.role));
      report(onActivity, 'control704_targets', true, 'control704 target status', started);
      return JSON.stringify({ caller, targets: list });
    },
    {
      name: 'control704_targets',
      description: 'List Control704 proxy targets X/Y/Z, whether each is configured, and what the current role may do.',
      schema: z.object({})
    }
  );

  const override = tool(
    async ({ dataset, key, value_json, reason, ttl_minutes, dry_run, confirm }) => {
      const started = Date.now();
      if (caller.role !== 'admin') {
        report(onActivity, 'dataset_override', false, 'dataset_override denied (admin required)', started);
        return JSON.stringify({ ok: false, error: 'admin_required', role: caller.role });
      }
      let value: unknown;
      try {
        value = JSON.parse(value_json);
      } catch {
        return JSON.stringify({ ok: false, error: 'value_json must be valid JSON' });
      }
      const out = submitOverride(
        {
          dataset,
          key,
          value,
          reason,
          ttlMinutes: ttl_minutes ?? null,
          dryRun: dry_run !== false,
          confirm: confirm === true
        },
        caller
      );
      report(onActivity, 'dataset_override', out.ok, `dataset_override ${out.ok ? out.mode : out.error}`, started);
      return JSON.stringify(out);
    },
    {
      name: 'dataset_override',
      description:
        'Admin-only break-glass dataset code override. ALWAYS run with dry_run=true first and show Jean the diff. ' +
        'Only call with dry_run=false and confirm=true after Jean explicitly confirms in chat. Reason (10+ chars) required. Every call is audited.',
      schema: z.object({
        dataset: z.string().describe('Dataset name (default datasets: x, y, z)'),
        key: z.string().describe('Dotted key inside the dataset, e.g. code or flags.mode'),
        value_json: z.string().describe('New value as JSON, e.g. "\\"ABC123\\"" or "{\\"on\\":true}"'),
        reason: z.string().describe('Why this override is needed (10-500 chars)'),
        ttl_minutes: z.number().int().min(1).max(43200).optional().describe('Optional expiry in minutes (max 30 days)'),
        dry_run: z.boolean().optional().describe('Preview only (default true)'),
        confirm: z.boolean().optional().describe('Must be true to apply when dry_run=false')
      })
    }
  );

  return [...proxyTools, targets, override];
}
