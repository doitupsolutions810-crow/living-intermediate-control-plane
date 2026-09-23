import { TOOL_DEFINITIONS, executeTool, type ToolActivity } from './agent-tools';
import { scrubSecrets } from './scrub';
import { formatOperatorNotes, loadLessons } from './operator-memory';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type LlmProvider =
  | 'openai'
  | 'xai'
  | 'grok'
  | 'openrouter'
  | 'groq'
  | 'mistral'
  | 'gemini'
  | 'nvidia'
  | 'cerebras'
  | 'huggingface'
  | 'compatible'
  | 'pollinations';

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: LlmProvider;
  /** Extra request headers (e.g. OpenRouter HTTP-Referer / X-Title). */
  headers?: Record<string, string>;
};

const MAX_TOOL_ROUNDS = 8;

/** Default preference: paid first (when credited), then free/OSS fallbacks. */
const DEFAULT_PROVIDER_ORDER: LlmProvider[] = [
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

const ALL_PROVIDERS = new Set<string>(DEFAULT_PROVIDER_ORDER);

const DEFAULT_OPENROUTER_FREE_MODELS = [
  'openrouter/free',
  'qwen/qwen3.8-27b:free',
  'nex-agi/nex-n2.5-pro:free',
  'inclusionai/ling-3.0-flash-vl:free'
];

const RETRYABLE_STATUS = new Set([401, 402, 403, 429]);

const RETRYABLE_BODY_RE =
  /credit|billing|spend|quota|permission[-_ ]?denied|insufficient[-_ ]?(?:funds|quota)|rate[-_ ]?limit|payment[-_ ]?required/i;

/** True when the LLM error should trigger trying the next configured provider. */
export function isRetryableLlmFailure(status: number, body: string): boolean {
  if (RETRYABLE_STATUS.has(status)) return true;
  return RETRYABLE_BODY_RE.test(String(body || ''));
}

function envTrim(name: string): string {
  return (process.env[name] || '').trim();
}

function isKeylessApiKey(apiKey: string): boolean {
  const k = (apiKey || '').trim().toLowerCase();
  return !k || k === 'none' || k === 'keyless';
}

function openRouterFreeModels(): string[] {
  const raw = envTrim('OPENROUTER_FREE_MODELS');
  const list = (raw || DEFAULT_OPENROUTER_FREE_MODELS.join(','))
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  // de-dupe preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of list) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out.length ? out : [...DEFAULT_OPENROUTER_FREE_MODELS];
}

/** Build zero-or-more configs for a provider (openrouter/groq may expand). */
export function configsFor(provider: LlmProvider): LlmConfig[] {
  if (provider === 'openai') {
    const apiKey = envTrim('OPENAI_API_KEY');
    if (!apiKey) return [];
    return [
      {
        apiKey,
        baseUrl: (envTrim('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, ''),
        model: envTrim('OPENAI_MODEL') || 'gpt-4o-mini',
        provider: 'openai'
      }
    ];
  }

  if (provider === 'xai') {
    const apiKey = envTrim('XAI_API_KEY');
    if (!apiKey) return [];
    return [
      {
        apiKey,
        baseUrl: (envTrim('XAI_BASE_URL') || 'https://api.x.ai/v1').replace(/\/$/, ''),
        model: envTrim('XAI_MODEL') || 'grok-2-latest',
        provider: 'xai'
      }
    ];
  }

  if (provider === 'grok') {
    const apiKey = envTrim('GROK_API_KEY');
    if (!apiKey) return [];
    return [
      {
        apiKey,
        baseUrl: (envTrim('GROK_BASE_URL') || 'https://api.x.ai/v1').replace(/\/$/, ''),
        model: envTrim('GROK_MODEL') || 'grok-2-latest',
        provider: 'grok'
      }
    ];
  }

  if (provider === 'openrouter') {
    const apiKey = envTrim('OPENROUTER_API_KEY');
    if (!apiKey) return [];
    const baseUrl = (envTrim('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1').replace(
      /\/$/,
      ''
    );
    const headers = {
      'HTTP-Referer': 'https://avrone-due-krey-chat.vercel.app',
      'X-Title': 'Avrone'
    };
    return openRouterFreeModels().map(model => ({
      apiKey,
      baseUrl,
      model,
      provider: 'openrouter' as const,
      headers
    }));
  }

  if (provider === 'groq') {
    const apiKey = envTrim('GROQ_API_KEY');
    if (!apiKey) return [];
    const baseUrl = (envTrim('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1').replace(
      /\/$/,
      ''
    );
    const primary = envTrim('GROQ_MODEL') || 'openai/gpt-oss-120b';
    const secondary = 'openai/gpt-oss-20b';
    const out: LlmConfig[] = [
      { apiKey, baseUrl, model: primary, provider: 'groq' }
    ];
    if (secondary !== primary) {
      out.push({ apiKey, baseUrl, model: secondary, provider: 'groq' });
    }
    return out;
  }

  if (provider === 'mistral') {
    const apiKey = envTrim('MISTRAL_API_KEY');
    if (!apiKey) return [];
    return [
      {
        apiKey,
        baseUrl: (envTrim('MISTRAL_BASE_URL') || 'https://api.mistral.ai/v1').replace(/\/$/, ''),
        model: envTrim('MISTRAL_MODEL') || 'mistral-small-latest',
        provider: 'mistral'
      }
    ];
  }

  if (provider === 'gemini') {
    const apiKey = envTrim('GEMINI_API_KEY');
    if (!apiKey) return [];
    return [
      {
        apiKey,
        baseUrl: (
          envTrim('GEMINI_BASE_URL') ||
          'https://generativelanguage.googleapis.com/v1beta/openai'
        ).replace(/\/$/, ''),
        model: envTrim('GEMINI_MODEL') || 'gemini-2.0-flash',
        provider: 'gemini'
      }
    ];
  }

  if (provider === 'nvidia') {
    const apiKey = envTrim('NVIDIA_API_KEY');
    if (!apiKey) return [];
    return [
      {
        apiKey,
        baseUrl: (envTrim('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1').replace(
          /\/$/,
          ''
        ),
        model: envTrim('NVIDIA_MODEL') || 'meta/llama-3.3-70b-instruct',
        provider: 'nvidia'
      }
    ];
  }

  if (provider === 'cerebras') {
    const apiKey = envTrim('CEREBRAS_API_KEY');
    if (!apiKey) return [];
    return [
      {
        apiKey,
        baseUrl: (envTrim('CEREBRAS_BASE_URL') || 'https://api.cerebras.ai/v1').replace(/\/$/, ''),
        model: envTrim('CEREBRAS_MODEL') || 'llama3.1-8b',
        provider: 'cerebras'
      }
    ];
  }

  if (provider === 'huggingface') {
    const apiKey = envTrim('HF_TOKEN') || envTrim('HUGGINGFACE_API_KEY');
    if (!apiKey) return [];
    return [
      {
        apiKey,
        baseUrl: (envTrim('HF_BASE_URL') || 'https://router.huggingface.co/v1').replace(/\/$/, ''),
        model: envTrim('HF_MODEL') || 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        provider: 'huggingface'
      }
    ];
  }

  if (provider === 'compatible') {
    const baseUrl = envTrim('AVRONE_COMPATIBLE_BASE_URL').replace(/\/$/, '');
    if (!baseUrl) return [];
    const apiKey = envTrim('AVRONE_COMPATIBLE_API_KEY') || 'keyless';
    return [
      {
        apiKey,
        baseUrl,
        model: envTrim('AVRONE_COMPATIBLE_MODEL') || 'default',
        provider: 'compatible'
      }
    ];
  }

  if (provider === 'pollinations') {
    // Keyless OSS fallback — disabled only when explicitly set to 0/false/off.
    const flag = envTrim('AVRONE_POLLINATIONS_ENABLED').toLowerCase();
    if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return [];
    return [
      {
        apiKey: 'keyless',
        baseUrl: (
          envTrim('AVRONE_POLLINATIONS_BASE_URL') || 'https://text.pollinations.ai/openai'
        ).replace(/\/$/, ''),
        model: envTrim('AVRONE_POLLINATIONS_MODEL') || 'openai-fast',
        provider: 'pollinations'
      }
    ];
  }

  return [];
}

/** Ordered provider preference: AVRONE_LLM_PREFER first when it matches a known provider. */
export function providerOrder(): LlmProvider[] {
  const prefer = envTrim('AVRONE_LLM_PREFER').toLowerCase();
  if (prefer && ALL_PROVIDERS.has(prefer)) {
    const p = prefer as LlmProvider;
    return [p, ...DEFAULT_PROVIDER_ORDER.filter(x => x !== p)];
  }
  return [...DEFAULT_PROVIDER_ORDER];
}

/** All configured LLM endpoints in preference order (may expand openrouter/groq). */
export function listLlmConfigs(): LlmConfig[] {
  const out: LlmConfig[] = [];
  for (const p of providerOrder()) {
    out.push(...configsFor(p));
  }
  return out;
}

/** First configured provider (respects AVRONE_LLM_PREFER). */
export function resolveLlmConfig(): LlmConfig | null {
  return listLlmConfigs()[0] ?? null;
}

const SYSTEM_PROMPT = `You are Avrone, a careful operator assistant for the Living Intermediate Control Plane.
You have tools: web_search, web_fetch, sandbox_js, sandbox_shell, remember_lesson.
Use tools when they improve factual accuracy or computation. Prefer sandbox_js over shell.
Never invent secrets. Never request or echo API keys. Keep answers concise and actionable.
When tools fail (missing keys, denied), explain clearly what Jean should configure.

Operator training (prompt-memory, NOT weight fine-tuning):
When Jean states a durable preference, fact, or operating rule worth remembering across sessions, call remember_lesson with a concise note.
Do not store secrets, API keys, or one-off ephemeral task details.`;

export type AgentLoopResult = {
  stream: ReadableStream<Uint8Array>;
  activities: ToolActivity[];
  provider: string;
  model: string;
};

type OnActivity = (a: ToolActivity) => void;

async function chatCompletion(
  cfg: LlmConfig,
  messages: ChatMessage[],
  opts?: { stream?: boolean; tools?: boolean }
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: 0.4
  };
  if (opts?.tools !== false) {
    body.tools = TOOL_DEFINITIONS;
    body.tool_choice = 'auto';
  }
  if (opts?.stream) body.stream = true;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(cfg.headers || {})
  };
  if (!isKeylessApiKey(cfg.apiKey)) {
    headers.authorization = `Bearer ${cfg.apiKey}`;
  }

  return fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(18_000)
  });
}

type ChatJson = {
  choices?: Array<{
    message?: ChatMessage;
    finish_reason?: string;
  }>;
};

/**
 * Call chat/completions; on retryable auth/billing/quota failures,
 * automatically try the next configured provider.
 */
async function chatCompletionWithFallback(
  configs: LlmConfig[],
  startIndex: number,
  messages: ChatMessage[],
  opts?: { stream?: boolean; tools?: boolean }
): Promise<{ data: ChatJson; cfg: LlmConfig; index: number }> {
  const failures: string[] = [];
  for (let i = startIndex; i < configs.length; i++) {
    const cfg = configs[i];
    let res: Response;
    try {
      res = await chatCompletion(cfg, messages, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const one = `LLM ${cfg.provider}/${cfg.model} network: ${scrubSecrets(msg).slice(0, 200)}`;
      failures.push(one);
      // Timeouts / network blips → try next provider (keeps Pollinations reachable on Vercel)
      continue;
    }
    const raw = await res.text().catch(() => '');
    if (res.ok) {
      let data: ChatJson;
      try {
        data = JSON.parse(raw) as ChatJson;
      } catch {
        throw new Error(`LLM ${cfg.provider} returned non-JSON body`);
      }
      return { data, cfg, index: i };
    }
    const errText = scrubSecrets(raw);
    const one = `LLM ${cfg.provider}/${cfg.model} HTTP ${res.status}: ${errText.slice(0, 400)}`;
    failures.push(one);
    if (!isRetryableLlmFailure(res.status, errText)) {
      throw new Error(failures.join(' | '));
    }
    // retryable — fall through to next provider
  }
  throw new Error(failures.join(' | ') || 'No LLM providers available');
}

/**
 * Multi-step tool loop; streams the final assistant answer as OpenAI-style SSE
 * (choices[0].delta.content). Emits SSE comment lines for tool activity.
 */
export async function runAgentLoop(
  userMessages: Array<{ role: string; content?: string }>,
  opts?: { systemAugment?: string; onActivity?: OnActivity; maxRounds?: number }
): Promise<AgentLoopResult> {
  const configs = listLlmConfigs();
  if (!configs.length) {
    throw new Error(
      'No LLM providers configured (set a paid key, a free-tier key, or leave Pollinations enabled)'
    );
  }

  let cfgIndex = 0;
  let cfg = configs[cfgIndex];

  const activities: ToolActivity[] = [];
  const maxRounds = opts?.maxRounds ?? MAX_TOOL_ROUNDS;

  const systemContent = [SYSTEM_PROMPT, formatOperatorNotes(loadLessons()), opts?.systemAugment]
    .filter(Boolean)
    .join('\n\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...userMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content || '').slice(0, 20_000)
      }))
  ];

  // Tool rounds (non-streaming) until we get a final content response or hit max.
  let finalContent = '';
  for (let round = 0; round < maxRounds; round++) {
    const { data, cfg: used, index } = await chatCompletionWithFallback(
      configs,
      cfgIndex,
      messages,
      { stream: false, tools: true }
    );
    cfg = used;
    cfgIndex = index;

    const msg = data.choices?.[0]?.message;
    if (!msg) {
      throw new Error('LLM returned empty choices');
    }

    const toolCalls = msg.tool_calls || [];
    if (toolCalls.length === 0) {
      finalContent = scrubSecrets(String(msg.content || ''));
      break;
    }

    messages.push({
      role: 'assistant',
      content: msg.content || null,
      tool_calls: toolCalls
    });

    for (const tc of toolCalls) {
      const name = tc.function?.name || '';
      const argStr = tc.function?.arguments || '{}';
      const { content, activity } = await executeTool(name, argStr);
      activities.push(activity);
      opts?.onActivity?.(activity);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name,
        content
      });
    }
  }

  if (!finalContent) {
    // One last turn without tools to force an answer.
    try {
      const { data, cfg: used, index } = await chatCompletionWithFallback(
        configs,
        cfgIndex,
        messages,
        { stream: false, tools: false }
      );
      cfg = used;
      cfgIndex = index;
      finalContent = scrubSecrets(String(data.choices?.[0]?.message?.content || ''));
    } catch {
      // keep empty; fall through to synthetic message below
    }
    if (!finalContent) {
      finalContent =
        activities.length > 0
          ? `Tool rounds completed (${activities.map(a => a.summary).join('; ')}), but no final model text. Check model/tool support.`
          : 'No response from model.';
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // SSE comments for UI tool activity (ignored by content parsers that only read data:)
      for (const a of activities) {
        controller.enqueue(
          encoder.encode(`: avrone-tool ${JSON.stringify(a)}\n\n`)
        );
      }
      // Stream content in small chunks for UX
      const chunkSize = 48;
      for (let i = 0; i < finalContent.length; i += chunkSize) {
        const piece = finalContent.slice(i, i + chunkSize);
        const payload = { choices: [{ delta: { content: piece } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return {
    stream,
    activities,
    provider: cfg.provider,
    model: cfg.model
  };
}

export function toolsSummaryHeader(activities: ToolActivity[]): string {
  try {
    return JSON.stringify(
      activities.map(a => ({
        name: a.name,
        ok: a.ok,
        summary: a.summary,
        ms: a.ms
      }))
    );
  } catch {
    return '[]';
  }
}
