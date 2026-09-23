import { TOOL_DEFINITIONS, executeTool, type ToolActivity } from './agent-tools';
import { scrubSecrets } from './scrub';

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

export type LlmProvider = 'xai' | 'openai' | 'grok';

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: LlmProvider;
};

const MAX_TOOL_ROUNDS = 8;

const DEFAULT_PROVIDER_ORDER: LlmProvider[] = ['xai', 'openai', 'grok'];

const RETRYABLE_STATUS = new Set([401, 402, 403, 429]);

const RETRYABLE_BODY_RE =
  /credit|billing|spend|quota|permission[-_ ]?denied|insufficient[-_ ]?(?:funds|quota)|rate[-_ ]?limit|payment[-_ ]?required/i;

/** True when the LLM error should trigger trying the next configured provider. */
export function isRetryableLlmFailure(status: number, body: string): boolean {
  if (RETRYABLE_STATUS.has(status)) return true;
  return RETRYABLE_BODY_RE.test(String(body || ''));
}

function configFor(provider: LlmProvider): LlmConfig | null {
  if (provider === 'xai') {
    const apiKey = (process.env.XAI_API_KEY || '').trim();
    if (!apiKey) return null;
    return {
      apiKey,
      baseUrl: (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, ''),
      model: process.env.XAI_MODEL || 'grok-2-latest',
      provider: 'xai'
    };
  }
  if (provider === 'openai') {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) return null;
    return {
      apiKey,
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      provider: 'openai'
    };
  }
  const apiKey = (process.env.GROK_API_KEY || '').trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.GROK_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, ''),
    model: process.env.GROK_MODEL || 'grok-2-latest',
    provider: 'grok'
  };
}

/** Ordered provider preference: AVRONE_LLM_PREFER first, else XAI → OPENAI → GROK. */
export function providerOrder(): LlmProvider[] {
  const prefer = (process.env.AVRONE_LLM_PREFER || '').trim().toLowerCase();
  if (prefer === 'openai' || prefer === 'xai' || prefer === 'grok') {
    return [prefer, ...DEFAULT_PROVIDER_ORDER.filter(p => p !== prefer)];
  }
  return [...DEFAULT_PROVIDER_ORDER];
}

/** All configured LLM providers in preference order. */
export function listLlmConfigs(): LlmConfig[] {
  const out: LlmConfig[] = [];
  for (const p of providerOrder()) {
    const cfg = configFor(p);
    if (cfg) out.push(cfg);
  }
  return out;
}

/** First configured provider (respects AVRONE_LLM_PREFER). */
export function resolveLlmConfig(): LlmConfig | null {
  return listLlmConfigs()[0] ?? null;
}

const SYSTEM_PROMPT = `You are Avrone, a careful operator assistant for the Living Intermediate Control Plane.
You have tools: web_search, web_fetch, sandbox_js, sandbox_shell.
Use tools when they improve factual accuracy or computation. Prefer sandbox_js over shell.
Never invent secrets. Never request or echo API keys. Keep answers concise and actionable.
When tools fail (missing keys, denied), explain clearly what Jean should configure.`;

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

  return fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000)
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
  let lastErr = 'No LLM providers available';
  for (let i = startIndex; i < configs.length; i++) {
    const cfg = configs[i];
    const res = await chatCompletion(cfg, messages, opts);
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
    lastErr = `LLM ${cfg.provider} HTTP ${res.status}: ${errText.slice(0, 400)}`;
    if (!isRetryableLlmFailure(res.status, errText)) {
      throw new Error(lastErr);
    }
    // retryable — fall through to next provider
  }
  throw new Error(lastErr);
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
    throw new Error('No LLM API key (set XAI_API_KEY, OPENAI_API_KEY, or GROK_API_KEY)');
  }

  let cfgIndex = 0;
  let cfg = configs[cfgIndex];

  const activities: ToolActivity[] = [];
  const maxRounds = opts?.maxRounds ?? MAX_TOOL_ROUNDS;

  const systemContent = [SYSTEM_PROMPT, opts?.systemAugment].filter(Boolean).join('\n\n');
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
