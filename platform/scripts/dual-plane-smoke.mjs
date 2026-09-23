#!/usr/bin/env node
/**
 * Dual-plane smoke: Node lattice + AVRONE stdlib stack.
 * Exit 0 only if probe, route, observation_publish, and attestation_link succeed.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, '..');
const pythonBridge = path.join(platformRoot, 'python-bridge');

const NODE_PORT = Number(process.env.SMOKE_NODE_PORT || 4417);
const PY_PORT = Number(process.env.SMOKE_PY_PORT || 8017);

const env = {
  ...process.env,
  CONTROL12_PLATFORM_ROOT: process.env.CONTROL12_PLATFORM_ROOT || '/tmp/c12-dual-smoke',
  CONTROL12_PLATFORM_PORT: String(NODE_PORT),
  CONTROL12_CHAT_OPEN: '1',
  AVRONE_STACK_URL: `http://127.0.0.1:${PY_PORT}`,
  AVRONE_STACK_PORT: String(PY_PORT),
  AVRONE_STACK_HOST: '127.0.0.1',
  ALLOW_AGENT_EXECUTION: 'true',
  LATTICE_OBSERVE_ON_ROUTE: '1',
  CONTROL12_PLATFORM_URL: `http://127.0.0.1:${NODE_PORT}`,
  PYTHONPATH: pythonBridge
};

function spawnLogged(cmd, args, cwd) {
  const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => {
    log += d;
  });
  child.stderr.on('data', (d) => {
    log += d;
  });
  child.getLog = () => log;
  return child;
}

async function hit(url, opts) {
  try {
    const r = await fetch(url, opts);
    const t = await r.text();
    return { status: r.status, body: t };
  } catch (e) {
    return { status: 0, body: String(e.message || e) };
  }
}

const node = spawnLogged('node', ['src/server.mjs'], platformRoot);
const py = spawnLogged('python3', ['-m', 'avrone_stack'], pythonBridge);

const base = `http://127.0.0.1:${NODE_PORT}`;
const checks = {};

for (let i = 0; i < 16; i++) {
  await sleep(500);
  const n = await hit(`${base}/health`);
  const p = await hit(`http://127.0.0.1:${PY_PORT}/health`);
  if (n.status === 200 && p.status === 200) break;
}

checks.health_node = await hit(`${base}/health`);
checks.health_py = await hit(`http://127.0.0.1:${PY_PORT}/health`);
checks.probe = await hit(`${base}/api/v1/bridge/avrone-stack/probe`);
checks.route = await hit(`${base}/api/v1/bridge/avrone-stack/route`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ message: 'analyze lattice tension', belief: 0.55 })
});
checks.obs = await hit(`${base}/api/v1/cockpit/action`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    action: 'observation_publish',
    belief: 0.55,
    observationText: 'dual-plane smoke'
  })
});
checks.link = await hit(`${base}/api/v1/cockpit/action`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    action: 'attestation_link',
    sessionId: 'smoke-sess',
    latticeObservation: 'dual-plane smoke'
  })
});
checks.cockpit_route = await hit(`${base}/api/v1/cockpit/action`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    action: 'avrone_stack_route',
    message: 'plan next dual-plane step',
    belief: 0.6
  })
});
checks.jacobian = await hit(`${base}/api/v1/cockpit/action`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    action: 'jacobian_outcome',
    belief: 0.55,
    outcome: 'accept',
    delta: 0.02
  })
});

node.kill();
py.kill();

const required = ['health_node', 'health_py', 'probe', 'route', 'obs', 'link', 'cockpit_route', 'jacobian'];
const failed = required.filter((k) => checks[k]?.status !== 200);

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      failed,
      checks: Object.fromEntries(
        Object.entries(checks).map(([k, v]) => [k, { status: v.status, preview: String(v.body).slice(0, 180) }])
      ),
      nodeLog: node.getLog().slice(0, 300),
      pyLog: py.getLog().slice(0, 300)
    },
    null,
    2
  )
);

process.exit(failed.length === 0 ? 0 : 1);
