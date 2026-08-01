#!/usr/bin/env node
/**
 * Llama coding agent entry
 *
 * Modes:
 *   node agents/llama/agent.mjs chat     — interactive auth + toolkit (no per-action approve)
 *   node agents/llama/agent.mjs run "…" — one shot if session authorized
 *   node agents/llama/agent.mjs status
 *   node agents/llama/agent.mjs revoke
 */

import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolkit } from './toolkit.mjs';
import { authorize, revoke, isAuthorized, readSession } from './session.mjs';
import { ollamaChat, ollamaTags } from './ollama.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const cfgPath = join(__dirname, 'config.json');
const config = existsSync(cfgPath)
  ? JSON.parse(readFileSync(cfgPath, 'utf8'))
  : { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2', sessionMinutes: 60 };

const toolkit = createToolkit(root);
const mode = process.argv[2] || 'status';
const promptArg = process.argv.slice(3).join(' ').trim();

const SYSTEM = `You are the plane's coding assistant (Llama via Ollama).
You help develop this repository under strict rules:
- You may only write files under workspace/
- You may queue auto tasks and run allowlisted plane steps via tools
- Final admission is plane unattended + CI; you never bypass security gates
- Prefer small, concrete proposals and task JSON
When you need a tool, reply with a single JSON line:
{"tool":"name","args":{...}}
Otherwise reply with normal assistant text.`;

async function ensureOllama() {
  try {
    await ollamaTags(config.baseUrl);
    return true;
  } catch (e) {
    console.error('[agent] Ollama not reachable at', config.baseUrl);
    console.error('[agent]', e.message || e);
    console.error('[agent] Install Ollama and pull a model: ollama pull', config.model);
    return false;
  }
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'list_tools':
      return toolkit.list_tools();
    case 'list_workspace':
      return toolkit.list_workspace(args.sub || '');
    case 'read_workspace_file':
      return toolkit.read_workspace_file(args.path);
    case 'write_workspace_file':
      return toolkit.write_workspace_file(args.path, args.content ?? '');
    case 'read_repo_file':
      return toolkit.read_repo_file(args.path);
    case 'run_plane_step':
      return toolkit.run_plane_step(args.step, args.env || {});
    case 'queue_auto_task':
      return toolkit.queue_auto_task(args.task || args);
    case 'session_status':
      return readSession(root) || { authorized: false };
    default:
      return { error: `unknown tool: ${name}` };
  }
}

function tryParseTool(text) {
  const line = String(text || '')
    .split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith('{') && l.includes('"tool"'));
  if (!line) return null;
  try {
    const obj = JSON.parse(line);
    if (obj && obj.tool) return obj;
  } catch {
    /* ignore */
  }
  return null;
}

async function agentTurn(userText, history) {
  history.push({ role: 'user', content: userText });
  let reply = await ollamaChat({
    baseUrl: config.baseUrl,
    model: config.model,
    messages: [{ role: 'system', content: SYSTEM }, ...history],
    timeoutMs: config.timeoutMs || 120000
  });

  // Up to 5 tool hops without per-action human approval (session already authorized)
  for (let i = 0; i < 5; i++) {
    const call = tryParseTool(reply);
    if (!call) break;
    const result = await callTool(call.tool, call.args || {});
    history.push({ role: 'assistant', content: reply });
    history.push({
      role: 'user',
      content: `TOOL_RESULT ${call.tool}:\n${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}`
    });
    reply = await ollamaChat({
      baseUrl: config.baseUrl,
      model: config.model,
      messages: [{ role: 'system', content: SYSTEM }, ...history],
      timeoutMs: config.timeoutMs || 120000
    });
  }

  history.push({ role: 'assistant', content: reply });
  return reply;
}

async function main() {
  if (mode === 'status') {
    const s = readSession(root);
    console.log(JSON.stringify({
      authorized: isAuthorized(root),
      session: s,
      model: config.model,
      baseUrl: config.baseUrl,
      tools: toolkit.list_tools()
    }, null, 2));
    return;
  }

  if (mode === 'revoke') {
    console.log(JSON.stringify(revoke(root), null, 2));
    return;
  }

  if (mode === 'run') {
    if (!isAuthorized(root)) {
      console.error('Not authorized. Run: plane agent-chat  (authorize in chat first)');
      process.exit(2);
    }
    if (!(await ensureOllama())) process.exit(1);
    if (!promptArg) {
      console.error('Usage: plane agent-run -- "your prompt"');
      process.exit(1);
    }
    const history = [];
    const reply = await agentTurn(promptArg, history);
    console.log(reply);
    return;
  }

  if (mode === 'chat') {
    if (!(await ensureOllama())) process.exit(1);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = q => new Promise(res => rl.question(q, res));

    console.log('Llama coding agent — plane gated');
    console.log(`Model: ${config.model} @ ${config.baseUrl}`);
    console.log('Commands: /auth  /revoke  /status  /unattended  /quit');
    console.log('Writes only under workspace/. Admission: plane unattended + CI.\n');

    if (!isAuthorized(root)) {
      const yn = (await ask('Authorize this chat session for allowlisted tools? [y/N] ')).trim().toLowerCase();
      if (yn === 'y' || yn === 'yes') {
        const s = authorize(root, { minutes: config.sessionMinutes || 60, source: 'chat' });
        console.log('Authorized until', s.expiresAt);
        console.log('Per-action approval: OFF (allowlist only) for this session.\n');
      } else {
        console.log('No authorization — read-only chat; tools disabled.\n');
      }
    } else {
      console.log('Session already active until', readSession(root).expiresAt, '\n');
    }

    const history = [];
    while (true) {
      const line = (await ask('you> ')).trim();
      if (!line) continue;
      if (line === '/quit' || line === '/exit') break;
      if (line === '/auth') {
        const s = authorize(root, { minutes: config.sessionMinutes || 60, source: 'chat' });
        console.log('Authorized until', s.expiresAt);
        continue;
      }
      if (line === '/revoke') {
        revoke(root);
        console.log('Session revoked. Outside sandbox/tools blocked.');
        continue;
      }
      if (line === '/status') {
        console.log(JSON.stringify({ authorized: isAuthorized(root), session: readSession(root) }, null, 2));
        continue;
      }
      if (line === '/unattended') {
        if (!isAuthorized(root)) {
          console.log('Authorize first with /auth');
          continue;
        }
        const r = await callTool('run_plane_step', { step: 'daily' });
        console.log(JSON.stringify(r, null, 2));
        continue;
      }
      if (!isAuthorized(root)) {
        console.log('assistant> (unauthorized) Authorize with /auth to use tools. I can still answer generally.');
      }
      try {
        const reply = await agentTurn(
          isAuthorized(root)
            ? line
            : `[UNAUTHORIZED — tools disabled] ${line}`,
          history
        );
        console.log('assistant>', reply);
      } catch (e) {
        console.error('assistant error:', e.message || e);
      }
    }
    rl.close();
    return;
  }

  console.error('Usage: agent.mjs [chat|run|status|revoke]');
  process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
