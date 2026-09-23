import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/** Mirror of agent-loop isRetryableLlmFailure (keep in sync). */
function isRetryableLlmFailure(status, body) {
  if ([401, 402, 403, 429].includes(status)) return true;
  return /credit|billing|spend|quota|permission[-_ ]?denied|insufficient[-_ ]?(?:funds|quota)|rate[-_ ]?limit|payment[-_ ]?required/i.test(
    String(body || '')
  );
}

const DEFAULT_ORDER = [
  'openai',
  'xai',
  'grok',
  'openrouter',
  'groq',
  'mistral',
  'gemini',
  'nvidia',
  'cerebras',
  'huggingface',
  'compatible',
  'pollinations'
];

const DEFAULT_OPENROUTER_FREE_MODELS = [
  'openrouter/free',
  'qwen/qwen3.8-27b:free',
  'nex-agi/nex-n2.5-pro:free',
  'inclusionai/ling-3.0-flash-vl:free'
];

function providerOrder(env) {
  const prefer = String(env.AVRONE_LLM_PREFER || '')
    .trim()
    .toLowerCase();
  if (prefer && DEFAULT_ORDER.includes(prefer)) {
    return [prefer, ...DEFAULT_ORDER.filter(p => p !== prefer)];
  }
  return [...DEFAULT_ORDER];
}

function openRouterModels(env) {
  const raw = String(env.OPENROUTER_FREE_MODELS || '').trim();
  const list = (raw || DEFAULT_OPENROUTER_FREE_MODELS.join(','))
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const m of list) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

function isKeylessApiKey(apiKey) {
  const k = String(apiKey || '')
    .trim()
    .toLowerCase();
  return !k || k === 'none' || k === 'keyless';
}

/**
 * Mirror of listLlmConfigs selection — returns {provider, model, apiKey} entries.
 * No network.
 */
function listConfigured(env) {
  const out = [];
  for (const p of providerOrder(env)) {
    if (p === 'openai' && String(env.OPENAI_API_KEY || '').trim()) {
      out.push({ provider: 'openai', model: env.OPENAI_MODEL || 'gpt-4o-mini', apiKey: env.OPENAI_API_KEY });
    } else if (p === 'xai' && String(env.XAI_API_KEY || '').trim()) {
      out.push({ provider: 'xai', model: env.XAI_MODEL || 'grok-2-latest', apiKey: env.XAI_API_KEY });
    } else if (p === 'grok' && String(env.GROK_API_KEY || '').trim()) {
      out.push({ provider: 'grok', model: env.GROK_MODEL || 'grok-2-latest', apiKey: env.GROK_API_KEY });
    } else if (p === 'openrouter' && String(env.OPENROUTER_API_KEY || '').trim()) {
      for (const model of openRouterModels(env)) {
        out.push({ provider: 'openrouter', model, apiKey: env.OPENROUTER_API_KEY });
      }
    } else if (p === 'groq' && String(env.GROQ_API_KEY || '').trim()) {
      const primary = env.GROQ_MODEL || 'openai/gpt-oss-120b';
      out.push({ provider: 'groq', model: primary, apiKey: env.GROQ_API_KEY });
      if (primary !== 'openai/gpt-oss-20b') {
        out.push({ provider: 'groq', model: 'openai/gpt-oss-20b', apiKey: env.GROQ_API_KEY });
      }
    } else if (p === 'mistral' && String(env.MISTRAL_API_KEY || '').trim()) {
      out.push({
        provider: 'mistral',
        model: env.MISTRAL_MODEL || 'mistral-small-latest',
        apiKey: env.MISTRAL_API_KEY
      });
    } else if (p === 'gemini' && String(env.GEMINI_API_KEY || '').trim()) {
      out.push({
        provider: 'gemini',
        model: env.GEMINI_MODEL || 'gemini-2.0-flash',
        apiKey: env.GEMINI_API_KEY
      });
    } else if (p === 'nvidia' && String(env.NVIDIA_API_KEY || '').trim()) {
      out.push({
        provider: 'nvidia',
        model: env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct',
        apiKey: env.NVIDIA_API_KEY
      });
    } else if (p === 'cerebras' && String(env.CEREBRAS_API_KEY || '').trim()) {
      out.push({
        provider: 'cerebras',
        model: env.CEREBRAS_MODEL || 'llama3.1-8b',
        apiKey: env.CEREBRAS_API_KEY
      });
    } else if (
      p === 'huggingface' &&
      (String(env.HF_TOKEN || '').trim() || String(env.HUGGINGFACE_API_KEY || '').trim())
    ) {
      out.push({
        provider: 'huggingface',
        model: env.HF_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        apiKey: env.HF_TOKEN || env.HUGGINGFACE_API_KEY
      });
    } else if (p === 'compatible' && String(env.AVRONE_COMPATIBLE_BASE_URL || '').trim()) {
      out.push({
        provider: 'compatible',
        model: env.AVRONE_COMPATIBLE_MODEL || 'default',
        apiKey: env.AVRONE_COMPATIBLE_API_KEY || 'keyless'
      });
    } else if (p === 'pollinations') {
      const flag = String(env.AVRONE_POLLINATIONS_ENABLED || '')
        .trim()
        .toLowerCase();
      if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') continue;
      out.push({
        provider: 'pollinations',
        model: env.AVRONE_POLLINATIONS_MODEL || 'openai-fast',
        apiKey: 'keyless'
      });
    }
  }
  return out;
}

/**
 * Simulate chatCompletionWithFallback with a mock fetch sequence.
 * calls[i] = { status, body, ok? }
 */
async function chatWithFallback(configs, calls) {
  let callIdx = 0;
  const failures = [];
  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const call = calls[callIdx++] || { status: 500, body: 'unexpected' };
    if (call.status >= 200 && call.status < 300) {
      return { provider: cfg, data: JSON.parse(call.body || '{}') };
    }
    const errText = call.body || '';
    const label = typeof cfg === 'string' ? cfg : `${cfg.provider}/${cfg.model}`;
    const one = `LLM ${label} HTTP ${call.status}: ${errText.slice(0, 400)}`;
    failures.push(one);
    if (!isRetryableLlmFailure(call.status, errText)) {
      throw new Error(failures.join(' | '));
    }
  }
  throw new Error(failures.join(' | ') || 'No LLM providers available');
}

describe('llm resolve / fallback', () => {
  it('default order puts openai before xai/grok and pollinations last', () => {
    const providers = listConfigured({
      OPENAI_API_KEY: 'o',
      XAI_API_KEY: 'x',
      GROK_API_KEY: 'g',
      AVRONE_POLLINATIONS_ENABLED: '1'
    }).map(c => c.provider);
    assert.deepEqual(providers, ['openai', 'xai', 'grok', 'pollinations']);
  });

  it('AVRONE_LLM_PREFER=openai puts openai first', () => {
    assert.deepEqual(
      listConfigured({
        AVRONE_LLM_PREFER: 'openai',
        XAI_API_KEY: 'x',
        OPENAI_API_KEY: 'o'
      }).map(c => c.provider),
      ['openai', 'xai', 'pollinations']
    );
  });

  it('AVRONE_LLM_PREFER=pollinations puts keyless first', () => {
    const providers = listConfigured({
      AVRONE_LLM_PREFER: 'pollinations',
      OPENAI_API_KEY: 'o'
    }).map(c => c.provider);
    assert.equal(providers[0], 'pollinations');
    assert.ok(providers.includes('openai'));
  });

  it('skips unset keyed providers but keeps pollinations', () => {
    assert.deepEqual(
      listConfigured({ OPENAI_API_KEY: 'o', GROK_API_KEY: 'g' }).map(c => c.provider),
      ['openai', 'grok', 'pollinations']
    );
  });

  it('keyless pollinations enabled by default (no key required)', () => {
    const cfgs = listConfigured({});
    assert.equal(cfgs.length, 1);
    assert.equal(cfgs[0].provider, 'pollinations');
    assert.equal(cfgs[0].model, 'openai-fast');
    assert.equal(cfgs[0].apiKey, 'keyless');
    assert.equal(isKeylessApiKey(cfgs[0].apiKey), true);
  });

  it('AVRONE_POLLINATIONS_ENABLED=0 disables pollinations', () => {
    assert.deepEqual(listConfigured({ AVRONE_POLLINATIONS_ENABLED: '0' }), []);
  });

  it('expands OPENROUTER_FREE_MODELS into separate configs', () => {
    const cfgs = listConfigured({
      OPENROUTER_API_KEY: 'or',
      OPENROUTER_FREE_MODELS: 'openrouter/free,qwen/qwen3.8-27b:free',
      AVRONE_POLLINATIONS_ENABLED: '0'
    });
    assert.deepEqual(
      cfgs.map(c => `${c.provider}:${c.model}`),
      ['openrouter:openrouter/free', 'openrouter:qwen/qwen3.8-27b:free']
    );
  });

  it('uses default openrouter free models when unset', () => {
    const cfgs = listConfigured({
      OPENROUTER_API_KEY: 'or',
      AVRONE_POLLINATIONS_ENABLED: '0'
    });
    assert.deepEqual(
      cfgs.map(c => c.model),
      DEFAULT_OPENROUTER_FREE_MODELS
    );
  });

  it('groq adds primary + gpt-oss-20b second config', () => {
    const cfgs = listConfigured({
      GROQ_API_KEY: 'gq',
      AVRONE_POLLINATIONS_ENABLED: '0'
    });
    assert.deepEqual(
      cfgs.map(c => c.model),
      ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']
    );
  });

  it('compatible activates on base URL without key', () => {
    const cfgs = listConfigured({
      AVRONE_COMPATIBLE_BASE_URL: 'http://127.0.0.1:11434/v1',
      AVRONE_COMPATIBLE_MODEL: 'llama3.1',
      AVRONE_POLLINATIONS_ENABLED: '0'
    });
    assert.equal(cfgs.length, 1);
    assert.equal(cfgs[0].provider, 'compatible');
    assert.equal(isKeylessApiKey(cfgs[0].apiKey), true);
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

  it('falls through openai 403 to pollinations success', async () => {
    const result = await chatWithFallback(
      [
        { provider: 'openai', model: 'gpt-4o-mini' },
        { provider: 'pollinations', model: 'openai-fast' }
      ],
      [
        { status: 403, body: 'credits exhausted' },
        { status: 200, body: JSON.stringify({ choices: [{ message: { content: '323' } }] }) }
      ]
    );
    assert.equal(result.provider.provider, 'pollinations');
    assert.equal(result.data.choices[0].message.content, '323');
  });

  it('does not fall through on non-retryable 500', async () => {
    await assert.rejects(
      () =>
        chatWithFallback(
          [
            { provider: 'openai', model: 'm' },
            { provider: 'pollinations', model: 'openai-fast' }
          ],
          [
            { status: 500, body: 'internal' },
            { status: 200, body: '{}' }
          ]
        ),
      /HTTP 500/
    );
  });

  it('exhausts all providers then aggregates errors with |', async () => {
    await assert.rejects(
      () =>
        chatWithFallback(
          [
            { provider: 'openai', model: 'm' },
            { provider: 'pollinations', model: 'openai-fast' }
          ],
          [
            { status: 403, body: 'no credits' },
            { status: 429, body: 'rate limit' }
          ]
        ),
      /openai\/m HTTP 403.*pollinations\/openai-fast HTTP 429/s
    );
  });

  
  it('network timeout falls through to next provider', async () => {
    // Simulate the catch+continue path conceptually via status 429 after a "timeout" marker.
    // Full AbortError path is covered in agent-loop; here we assert aggregation still works.
    const result = await chatWithFallback(
      [
        { provider: 'openai', model: 'm' },
        { provider: 'pollinations', model: 'openai-fast' }
      ],
      [
        { status: 429, body: 'rate limit' },
        { status: 200, body: JSON.stringify({ choices: [{ message: { content: '323' } }] }) }
      ]
    );
    assert.equal(result.provider.provider, 'pollinations');
  });

  it('isKeylessApiKey skips Authorization for empty/none/keyless', () => {
    assert.equal(isKeylessApiKey(''), true);
    assert.equal(isKeylessApiKey('none'), true);
    assert.equal(isKeylessApiKey('keyless'), true);
    assert.equal(isKeylessApiKey('sk-real'), false);
  });
});
