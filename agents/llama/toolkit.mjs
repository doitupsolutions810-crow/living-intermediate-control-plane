/**
 * Allowlisted toolkit — no arbitrary shell, no writes outside workspace/
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, normalize, relative, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const PLANE_STEPS = new Set([
  'upgrade-check',
  'verify-changes',
  'doctor',
  'self-test',
  'checklist',
  'health',
  'security-scan',
  'metrics',
  'security-summary',
  'daily',
  'init'
]);

const STEP_FILES = {
  'upgrade-check': 'status/upgrade-check.mjs',
  'verify-changes': 'status/verify-changes.mjs',
  doctor: 'status/doctor.mjs',
  'self-test': 'test/self-test.mjs',
  checklist: 'status/checklist.mjs',
  health: 'status/health.mjs',
  'security-scan': 'status/security-scan.mjs',
  metrics: 'status/metrics.mjs',
  'security-summary': 'status/security-summary.mjs',
  daily: 'status/daily-loop.mjs',
  init: 'status/init.mjs'
};

export function createToolkit(root) {
  const workspace = join(root, 'workspace');

  function resolveWorkspace(rel) {
    const cleaned = normalize(String(rel || '').replace(/^\/+/, ''));
    const full = join(workspace, cleaned);
    const relToWs = relative(workspace, full);
    if (relToWs.startsWith('..') || relToWs === '') {
      // allow writing files under workspace only; empty means workspace root listing
    }
    if (relToWs.startsWith('..')) {
      throw new Error('path escapes workspace/');
    }
    return full;
  }

  return {
    list_tools() {
      return [
        'list_tools',
        'list_workspace',
        'read_workspace_file',
        'write_workspace_file',
        'read_repo_file',
        'run_plane_step',
        'queue_auto_task',
        'session_status'
      ];
    },

    list_workspace(sub = '') {
      const dir = sub ? resolveWorkspace(sub) : workspace;
      if (!existsSync(dir)) return [];
      return readdirSync(dir).map(name => {
        const p = join(dir, name);
        const st = statSync(p);
        return { name, type: st.isDirectory() ? 'dir' : 'file', size: st.size };
      });
    },

    read_workspace_file(rel) {
      const full = resolveWorkspace(rel);
      return readFileSync(full, 'utf8');
    },

    write_workspace_file(rel, content) {
      const full = resolveWorkspace(rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, String(content), 'utf8');
      return { ok: true, path: relative(root, full) };
    },

    read_repo_file(rel) {
      // read-only anywhere in repo for context; no writes
      const cleaned = normalize(String(rel || '').replace(/^\/+/, ''));
      const full = join(root, cleaned);
      const relToRoot = relative(root, full);
      if (relToRoot.startsWith('..')) throw new Error('path escapes repo');
      if (!existsSync(full) || statSync(full).isDirectory()) {
        throw new Error('not a file');
      }
      const text = readFileSync(full, 'utf8');
      // cap size
      return text.length > 200000 ? text.slice(0, 200000) + '\n/* truncated */' : text;
    },

    run_plane_step(step, env = {}) {
      if (!PLANE_STEPS.has(step)) {
        throw new Error(`step not allowlisted: ${step}`);
      }
      const file = STEP_FILES[step];
      const r = spawnSync(process.execPath, [join(root, file)], {
        cwd: root,
        env: { ...process.env, ...env, ALLOW_SKIP: env.ALLOW_SKIP || process.env.ALLOW_SKIP || '1' },
        encoding: 'utf8'
      });
      return {
        ok: r.status === 0,
        status: r.status,
        stdout: (r.stdout || '').slice(-8000),
        stderr: (r.stderr || '').slice(-4000)
      };
    },

    queue_auto_task(task) {
      if (!task || typeof task !== 'object') throw new Error('task object required');
      const id = String(task.id || `task-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const steps = Array.isArray(task.steps)
        ? task.steps.filter(s => PLANE_STEPS.has(s))
        : ['verify-changes', 'doctor'];
      const body = {
        id,
        type: task.type || 'verify',
        auto: true,
        enabled: true,
        description: String(task.description || 'queued by llama agent'),
        steps
      };
      const path = join(workspace, 'tasks', `${id}.json`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(body, null, 2) + '\n');
      return { ok: true, path: relative(root, path), task: body };
    }
  };
}
