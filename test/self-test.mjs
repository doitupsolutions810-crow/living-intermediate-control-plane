#!/usr/bin/env node
/**
 * Self-test for Living Intermediate Control Plane
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitReadinessEvidence } from '../lattice/readiness-poller.mjs';
import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';
import { handleLaunchDeskAction, listNamedActions } from '../launchdesk/actions.mjs';
import { createToolkit } from '../agents/llama/toolkit.mjs';
import { invokeTool } from '../agents/llama/agent.mjs';
import { readPlaneState } from '../status/plane-state.mjs';
import { probeEvidenceConsole } from '../lib/evidence-console.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

console.log('Self-test — Living Intermediate Control Plane\n');

const readiness = emitReadinessEvidence({ source: 'self-test' });
assert(readiness.provider === 'deterministic-local-evidence', 'readiness provider is deterministic-local-evidence');
assert(readiness.overallDecision === 'READY', 'readiness overallDecision is READY');
assert(Array.isArray(readiness.failedGates) && readiness.failedGates.length === 0, 'no failed gates');
assert(readiness.securityValue === 'High', 'securityValue is High');

const plan = evaluateQuorum(createOrchestrationPlan('self-test'));
assert(plan.overallDecision === 'READY', 'orchestration overallDecision is READY');
assert(plan.roles.length === 5, 'five roles present');
assert(plan.roles.every(r => r.status === 'READY'), 'all five roles READY');

const action = handleLaunchDeskAction('status', 'self-test');
assert(action.accepted === true, 'LaunchDesk action accepted');
assert(action.decision === 'READY', 'LaunchDesk decision is READY');
assert(action.knownAction === true, 'status is a known named action');

const named = listNamedActions();
assert(named.length >= 5, 'named LaunchDesk actions present');
assert(named.some(a => a.name === 'procure'), 'procure action exists');
assert(named.some(a => a.name === 'pause'), 'pause action exists');

const state = readPlaneState();
assert(typeof state.paused === 'boolean', 'plane state readable');

assert(existsSync(join(root, 'policy/trivy-results.rego')), 'trivy policy present');
assert(existsSync(join(root, 'policy/snyk-results.rego')), 'snyk policy present');
assert(existsSync(join(root, 'Dockerfile')), 'Dockerfile present');
assert(existsSync(join(root, 'status/checklist.mjs')), 'checklist present');
assert(existsSync(join(root, 'status/metrics.mjs')), 'metrics present');

// avrone-chat ship surface
assert(existsSync(join(root, 'avrone-chat/package.json')), 'avrone-chat package.json present');
assert(existsSync(join(root, 'avrone-chat/vercel.json')), 'avrone-chat vercel.json present');
assert(existsSync(join(root, 'avrone-chat/.env.example')), 'avrone-chat env example present');
assert(existsSync(join(root, 'avrone-chat/app/page.tsx')), 'avrone-chat page present');
assert(existsSync(join(root, 'avrone-chat/app/api/health/route.ts')), 'avrone-chat health route present');
assert(existsSync(join(root, 'avrone-chat/app/api/cockpit/route.ts')), 'avrone-chat cockpit route present');

// evidence-console graceful behavior (stubbed fetch — no network)
const unset = await probeEvidenceConsole({ url: '', acceptLocal: true });
assert(unset.status === 'unconfigured', 'evidence-console unconfigured when URL empty');
assert(unset.authority === 'local', 'unconfigured console uses local authority');

const notFound = await probeEvidenceConsole({
  url: 'https://evidence.example.invalid/console',
  acceptLocal: true,
  fetchImpl: async () => new Response('missing', { status: 404 })
});
assert(notFound.status === 'not_found', 'evidence-console 404 maps to not_found');
assert(notFound.authority === 'local', '404 console falls back to local authority');
assert(notFound.httpStatus === 404, '404 httpStatus preserved');

const ok = await probeEvidenceConsole({
  url: 'https://evidence.example.invalid/console',
  acceptLocal: true,
  fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
});
assert(ok.status === 'ok', 'evidence-console 200 maps to ok');
assert(ok.authority === 'public', 'healthy console uses public authority');

const boom = await probeEvidenceConsole({
  url: 'https://evidence.example.invalid/console',
  acceptLocal: true,
  fetchImpl: async () => {
    throw new Error('network down');
  }
});
assert(boom.status === 'unreachable', 'evidence-console network error maps to unreachable');
assert(boom.authority === 'local', 'unreachable console falls back to local authority');

const tmpRoot = mkdtempSync(join(tmpdir(), 'llama-toolkit-'));
try {
  mkdirSync(join(tmpRoot, 'workspace', 'proposals'), { recursive: true });
  writeFileSync(join(tmpRoot, 'workspace', 'hello.txt'), 'hi from toolkit');
  writeFileSync(join(tmpRoot, 'workspace', 'proposals', 'note.md'), '# note\n');
  const tk = createToolkit(tmpRoot);

  assert(tk.read_workspace_file('hello.txt') === 'hi from toolkit', 'read_workspace_file returns file contents');

  const listing = JSON.parse(tk.read_workspace_file('proposals'));
  assert(Array.isArray(listing), 'directory read returns JSON listing');
  assert(listing.some(e => e.name === 'note.md' && e.type === 'file'), 'directory listing includes nested file');

  const rootListing = JSON.parse(tk.read_workspace_file(''));
  assert(rootListing.some(e => e.name === 'hello.txt' && e.type === 'file'), 'empty path lists workspace root');
  assert(rootListing.some(e => e.name === 'proposals' && e.type === 'dir'), 'workspace root listing includes dirs');

  let missingErr = null;
  try {
    tk.read_workspace_file('no-such-file.txt');
  } catch (e) {
    missingErr = e;
  }
  assert(missingErr instanceof Error, 'missing workspace path throws');
  assert(/not found/i.test(missingErr.message), 'missing path error is clear');
  assert(!/EISDIR/i.test(missingErr.message), 'missing path error is not EISDIR');

  tk.write_workspace_file('proposals/out.txt', 'written');
  assert(tk.read_workspace_file('proposals/out.txt') === 'written', 'write_workspace_file still writes content');
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

const missingTool = await invokeTool('read_workspace_file', { path: `missing-${Date.now()}.txt` });
assert(missingTool && typeof missingTool === 'object', 'invokeTool returns an object on throw');
assert(typeof missingTool.error === 'string' && /not found/i.test(missingTool.error), 'thrown tool error becomes { error }');

const dirTool = await invokeTool('read_workspace_file', { path: '' });
assert(typeof dirTool === 'string', 'invokeTool directory read returns listing string');
assert(Array.isArray(JSON.parse(dirTool)), 'invokeTool directory listing is JSON array');

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
