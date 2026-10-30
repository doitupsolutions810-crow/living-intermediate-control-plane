import test from 'node:test';
import assert from 'node:assert/strict';
import { createSseParser, readSseResponse } from '../lib/chat-stream.mjs';

test('SSE parser handles split chunks, tool metadata, and final event flush', () => {
  const deltas = [];
  const tools = [];
  const parser = createSseParser(delta => deltas.push(delta), tool => tools.push(tool));
  const encoder = new TextEncoder();
  const first = ': avrone-tool {"summary":"web search"}\r\n\r\ndata: {"choices":[{"delta":{"content":"Hello "}}]}\r\n\r\n';
  parser.push(encoder.encode(first.slice(0, 40)));
  parser.push(encoder.encode(first.slice(40) + 'data: {"choices":[{"delta":{"content":"world"}}]}'));
  parser.finish();

  assert.equal(deltas.join(''), 'Hello world');
  assert.deepEqual(tools, [{ summary: 'web search' }]);
});

test('non-2xx stream responses raise actionable errors instead of parsing prose as an answer', async () => {
  const response = new Response(JSON.stringify({
    error: 'provider_error',
    message: 'The configured language model could not complete this turn. No LLM providers available'
  }), { status: 502, headers: { 'content-type': 'application/json' } });

  await assert.rejects(
    readSseResponse(response, () => {}, () => {}),
    /No LLM providers available/
  );
});
