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

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: 'xai' | 'openai' | 'grok';
};

const MAX_TOOL_ROUNDS = 8;

export function resolveLlmConfig(): LlmConfig | null {
  const xai = (process.env.XAI_API_KEY || '').trim();
  if (xai) {
    return {
      apiKey: xai,
      baseUrl: (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, ''),
      model: process.env.XAI_MODEL || 'grok-2-latest',
      provider: 'xai'
    };
  }
  const openai = (process.env.OPENAI_API_KEY || '').trim();
  if (openai) {
    return {
      apiKey: openai,
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      provider: 'openai'
    };
  }
  const grok = (process.env.GROK_API_KEY || '').trim();
  if (grok) {
    return {
      apiKey: grok,
      baseUrl: (process.env.GROK_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, ''),
      model: process.env.GROK_MODEL || 'grok-2-latest',
      provider: 'grok'
    };
  }
  return null;
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

/**
 * Multi-step tool loop; streams the final assistant answer as OpenAI-style SSE
 * (choices[0].delta.content). Emits SSE comment lines for tool activity.
 */
export async function runAgentLoop(
  userMessages: Array<{ role: string; content?: string }>,
  opts?: { systemAugment?: string; onActivity?: OnActivity; maxRounds?: number }
): Promise<AgentLoopResult> {
  const cfg = resolveLlmConfig();
  if (!cfg) {
    throw new Error('No LLM API key (set XAI_API_KEY, OPENAI_API_KEY, or GROK_API_KEY)');
  }

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
    const res = await chatCompletion(cfg, messages, { stream: false, tools: true });
    if (!res.ok) {
      const errText = scrubSecrets(await res.text().catch(() => ''));
      throw new Error(`LLM ${cfg.provider} HTTP ${res.status}: ${errText.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: ChatMessage;
        finish_reason?: string;
      }>;
    };

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
    const res = await chatCompletion(cfg, messages, { stream: false, tools: false });
    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      finalContent = scrubSecrets(String(data.choices?.[0]?.message?.content || ''));
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
