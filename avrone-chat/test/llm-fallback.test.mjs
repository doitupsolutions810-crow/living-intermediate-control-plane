import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/** Mirror of agent-loop isRetryableLlmFailure (keep in sync). */
function isRetryableLlmFailure(status, body) {
  if ([401, 402, 403, 429].includes(status)) return true;
  return /credit|billing|spend|quota|permission[-_ ]?denied|insufficient[-_ ]?(?:funds|quota)|rate[-_ ]?limit|payment[-_ ]?required/i.test(
    String(body || '')
  );
}

/** Mirror of agent-loop providerOrder / listLlmConfigs selection. */
function providerOrder(env) {
  const prefer = String(env.AVRONE_LLM_PREFER || '')
    .trim()
    .toLowerCase();
  const base = ['xai', 'openai', 'grok'];
  if (prefer === 'openai' || prefer === 'xai' || prefer === 'grok') {
    return [prefer, ...base.filter(p => p !== prefer)];
  }
  return [...base];
}

function listConfigured(env) {
  const keys = {
    xai: env.XAI_API_KEY,
    openai: env.OPENAI_API_KEY,
    grok: env.GROK_API_KEY
  };
  return providerOrder(env).filter(p => String(keys[p] || '').trim());
}

/**
 * Simulate chatCompletionWithFallback with a mock fetch sequence.
 * calls[i] = { status, body, ok? }
 */
async function chatWithFallback(configs, calls) {
  let callIdx = 0;
  let lastErr = 'No LLM providers available';
  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const call = calls[callIdx++] || { status: 500, body: 'unexpected' };
    if (call.status >= 200 && call.status < 300) {
      return { provider: cfg, data: JSON.parse(call.body || '{}') };
    }
    const errText = call.body || '';
    lastErr = `LLM ${cfg} HTTP ${call.status}: ${errText.slice(0, 400)}`;
    if (!isRetryableLlmFailure(call.status, errText)) {
      throw new Error(lastErr);
    }
  }
  throw new Error(lastErr);
}

describe('llm resolve / fallback', () => {
  it('orders XAI → OPENAI → GROK by default', () => {
    assert.deepEqual(
      listConfigured({
        XAI_API_KEY: 'x',
        OPENAI_API_KEY: 'o',
        GROK_API_KEY: 'g'
      }),
      ['xai', 'openai', 'grok']
    );
  });

  it('AVRONE_LLM_PREFER=openai puts openai first', () => {
    assert.deepEqual(
      listConfigured({
        AVRONE_LLM_PREFER: 'openai',
        XAI_API_KEY: 'x',
        OPENAI_API_KEY: 'o'
      }),
      ['openai', 'xai']
    );
  });

  it('skips unset providers', () => {
    assert.deepEqual(
      listConfigured({ OPENAI_API_KEY: 'o', GROK_API_KEY: 'g' }),
      ['openai', 'grok']
    );
  });

  it('treats 401/402/403/429 as retryable', () => {
    for (const s of [401, 402, 403, 429]) {
      assert.equal(isRetryableLlmFailure(s, ''), true);
    }
    assert.equal(isRetryableLlmFailure(500, ''), false);
    assert.equal(isRetryableLlmFailure(400, ''), false);
  });

  it('treats billing/credit/quota body as retryable even on 400', () => {
    assert.equal(isRetryableLlmFailure(400, 'Credits exhausted'), true);
    assert.equal(isRetryableLlmFailure(400, 'billing hard limit'), true);
    assert.equal(isRetryableLlmFailure(400, 'quota exceeded'), true);
    assert.equal(isRetryableLlmFailure(400, 'permission denied'), true);
    assert.equal(isRetryableLlmFailure(400, 'normal bad request'), false);
  });

  it('falls through XAI 403 to OpenAI success', async () => {
    const result = await chatWithFallback(['xai', 'openai'], [
      { status: 403, body: 'credits exhausted' },
      { status: 200, body: JSON.stringify({ choices: [{ message: { content: '323' } }] }) }
    ]);
    assert.equal(result.provider, 'openai');
    assert.equal(result.data.choices[0].message.content, '323');
  });

  it('does not fall through on non-retryable 500', async () => {
    await assert.rejects(
      () =>
        chatWithFallback(['xai', 'openai'], [
          { status: 500, body: 'internal' },
          { status: 200, body: '{}' }
        ]),
      /HTTP 500/
    );
  });

  it('exhausts all providers then throws last error', async () => {
    await assert.rejects(
      () =>
        chatWithFallback(['xai', 'openai'], [
          { status: 403, body: 'no credits' },
          { status: 429, body: 'rate limit' }
        ]),
      /openai HTTP 429/
    );
  });
});
