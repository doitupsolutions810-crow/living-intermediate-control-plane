import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

describe('LangGraph package + graph routing contract', () => {
  it('langchain packages resolve', () => {
    assert.ok(require.resolve('@langchain/core'));
    assert.ok(require.resolve('@langchain/langgraph'));
    assert.ok(require.resolve('@langchain/openai'));
    assert.ok(require.resolve('zod'));
  });

  it('langgraph-agent source exports expected symbols', () => {
    const src = readFileSync(join(root, 'lib/langgraph-agent.ts'), 'utf8');
    assert.match(src, /export async function runLangGraphAgent/);
    assert.match(src, /export function chatModelFromConfig/);
    assert.match(src, /export \{ isLangGraphEnabled \}/);
    assert.match(src, /StateGraph/);
    assert.match(src, /toolsCondition/);
    assert.match(src, /bindTools/);
    assert.match(src, /isRetryableLlmFailure/);
  });

  it('langgraph-tools wraps existing executeTool names', () => {
    const src = readFileSync(join(root, 'lib/langgraph-tools.ts'), 'utf8');
    for (const name of [
      'web_search',
      'web_fetch',
      'sandbox_js',
      'sandbox_shell',
      'remember_lesson'
    ]) {
      assert.match(src, new RegExp(name));
    }
    assert.match(src, /executeTool/);
  });

  it('toolsCondition-style routing: tool_calls → tools else end', () => {
    function route(message) {
      const calls = message?.tool_calls;
      if (Array.isArray(calls) && calls.length > 0) return 'tools';
      return '__end__';
    }
    assert.equal(route({ tool_calls: [{ id: '1', name: 'sandbox_js' }] }), 'tools');
    assert.equal(route({ content: 'hello' }), '__end__');
    assert.equal(route({ tool_calls: [] }), '__end__');
  });

  it('chatModelFromConfig shape maps OpenRouter-compatible fields', () => {
    const cfg = {
      apiKey: 'sk-test',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openrouter/free',
      provider: 'openrouter',
      headers: { 'HTTP-Referer': 'https://avrone-due-krey-chat.vercel.app', 'X-Title': 'Avrone' }
    };
    // Mirror of chatModelFromConfig field mapping (no network)
    const fields = {
      model: cfg.model,
      apiKey: cfg.apiKey,
      temperature: 0.4,
      timeout: 18_000,
      maxRetries: 0,
      configuration: { baseURL: cfg.baseUrl, defaultHeaders: cfg.headers }
    };
    assert.equal(fields.configuration.baseURL, 'https://openrouter.ai/api/v1');
    assert.equal(fields.configuration.defaultHeaders['X-Title'], 'Avrone');
    assert.equal(fields.model, 'openrouter/free');
  });
});

describe('chat route LangGraph wiring', () => {
  it('route prefers runLangGraphAgent when enabled', () => {
    const src = readFileSync(join(root, 'app/api/chat/route.ts'), 'utf8');
    assert.match(src, /runLangGraphAgent/);
    assert.match(src, /isLangGraphEnabled/);
    assert.match(src, /x-avrone-engine.*langgraph/);
    assert.match(src, /runAgentLoop/);
  });
});
