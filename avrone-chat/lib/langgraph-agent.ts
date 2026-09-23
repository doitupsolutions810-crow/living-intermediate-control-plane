/**
 * LangGraph StateGraph agent (llmCall ↔ tools) for Avrone chat.
 * Uses ChatOpenAI against listLlmConfigs() with the same retryable fallback
 * semantics as runAgentLoop. Falls back to the classic loop when disabled
 * or when the graph throws.
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage
} from '@langchain/core/messages';
import {
  Annotation,
  END,
  START,
  StateGraph,
  messagesStateReducer
} from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import {
  isRetryableLlmFailure,
  listLlmConfigs,
  type AgentLoopResult,
  type LlmConfig
} from './agent-loop';
import type { ToolActivity } from './agent-tools';
import { scrubSecrets } from './scrub';
import { buildLangChainTools } from './langgraph-tools';
import {
  formatOperatorNotes,
  isLangGraphEnabled,
  loadLessons
} from './operator-memory';
import { ensureLangSmithEnv } from './langsmith-init';

// Optional LangSmith: no-op unless tracing flag + API key (official env vars).
ensureLangSmithEnv();

export { isLangGraphEnabled };

const MAX_TOOL_ROUNDS = 8;

const SYSTEM_PROMPT = `You are Avrone, a careful operator assistant for the Living Intermediate Control Plane.
You have tools: web_search, web_fetch, sandbox_js, sandbox_shell, remember_lesson.
Use tools when they improve factual accuracy or computation. Prefer sandbox_js over shell.
Never invent secrets. Never request or echo API keys. Keep answers concise and actionable.
When tools fail (missing keys, denied), explain clearly what Jean should configure.

Operator training (prompt-memory, NOT weight fine-tuning):
When Jean states a durable preference, fact, or operating rule worth remembering across sessions, call remember_lesson with a concise note.
Do not store secrets, API keys, or one-off ephemeral task details.`;

function isKeylessApiKey(apiKey: string): boolean {
  const k = (apiKey || '').trim().toLowerCase();
  return !k || k === 'none' || k === 'keyless';
}

/** Build ChatOpenAI pointed at an OpenAI-compatible Avrone LlmConfig. */
export function chatModelFromConfig(cfg: LlmConfig): ChatOpenAI {
  const configuration: {
    baseURL: string;
    defaultHeaders?: Record<string, string>;
    apiKey?: string;
  } = {
    baseURL: cfg.baseUrl,
    defaultHeaders: cfg.headers
  };

  // Keyless providers (Pollinations): omit Bearer; openai SDK still wants a placeholder.
  const apiKey = isKeylessApiKey(cfg.apiKey) ? 'keyless' : cfg.apiKey;

  return new ChatOpenAI({
    model: cfg.model,
    apiKey,
    temperature: 0.4,
    timeout: 18_000,
    maxRetries: 0,
    configuration
  });
}

type OnActivity = (a: ToolActivity) => void;

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => []
  }),
  /** Index into listLlmConfigs() for the currently successful / next provider. */
  llmIndex: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0
  }),
  provider: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => ''
  }),
  model: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => ''
  })
});

function statusFromError(err: unknown): { status: number; body: string } {
  const anyErr = err as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
    message?: string;
    error?: unknown;
  };
  const status =
    Number(anyErr?.status ?? anyErr?.statusCode ?? anyErr?.response?.status ?? 0) || 0;
  const body = scrubSecrets(
    String(anyErr?.message || (anyErr?.error != null ? JSON.stringify(anyErr.error) : '') || err)
  );
  // Network / timeout → treat as retryable (same spirit as agent-loop)
  if (!status && /timeout|network|fetch|ECONN|ETIMEDOUT|AbortError/i.test(body)) {
    return { status: 429, body };
  }
  return { status: status || 500, body };
}

function buildGraph(configs: LlmConfig[], onActivity?: OnActivity) {
  const lcTools = buildLangChainTools(onActivity);
  const toolNode = new ToolNode(lcTools);

  async function llmCall(state: typeof AgentState.State) {
    const failures: string[] = [];
    let start = Math.max(0, state.llmIndex || 0);

    for (let i = start; i < configs.length; i++) {
      const cfg = configs[i];
      const model = chatModelFromConfig(cfg).bindTools(lcTools);
      try {
        const response = await model.invoke(state.messages);
        return {
          messages: [response],
          llmIndex: i,
          provider: cfg.provider,
          model: cfg.model
        };
      } catch (err) {
        const { status, body } = statusFromError(err);
        const one = `LLM ${cfg.provider}/${cfg.model} ${status || 'err'}: ${body.slice(0, 400)}`;
        failures.push(one);
        if (!isRetryableLlmFailure(status || 500, body)) {
          throw new Error(failures.join(' | '));
        }
        // retryable — try next config
      }
    }
    throw new Error(failures.join(' | ') || 'No LLM providers available');
  }

  const graph = new StateGraph(AgentState)
    .addNode('llmCall', llmCall)
    .addNode('tools', toolNode)
    .addEdge(START, 'llmCall')
    .addConditionalEdges('llmCall', toolsCondition, {
      tools: 'tools',
      [END]: END
    })
    .addEdge('tools', 'llmCall');

  return graph.compile();
}

function toLcMessages(
  systemContent: string,
  userMessages: Array<{ role: string; content?: string }>
): BaseMessage[] {
  const out: BaseMessage[] = [new SystemMessage(systemContent)];
  for (const m of userMessages) {
    if (m.role === 'user') {
      out.push(new HumanMessage(String(m.content || '').slice(0, 20_000)));
    } else if (m.role === 'assistant') {
      out.push(new AIMessage(String(m.content || '').slice(0, 20_000)));
    }
  }
  return out;
}

function finalAssistantText(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m._getType() === 'ai') {
      const content = (m as AIMessage).content;
      if (typeof content === 'string' && content.trim()) {
        return scrubSecrets(content);
      }
      if (Array.isArray(content)) {
        const text = content
          .map(part => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object' && 'text' in part) {
              return String((part as { text?: string }).text || '');
            }
            return '';
          })
          .join('');
        if (text.trim()) return scrubSecrets(text);
      }
    }
  }
  return '';
}

function sseStreamFromText(
  finalContent: string,
  activities: ToolActivity[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const a of activities) {
        controller.enqueue(encoder.encode(`: avrone-tool ${JSON.stringify(a)}\n\n`));
      }
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
}

/**
 * Run the LangGraph ReAct-style loop. Returns the same shape as runAgentLoop.
 */
export async function runLangGraphAgent(
  userMessages: Array<{ role: string; content?: string }>,
  opts?: { systemAugment?: string; onActivity?: OnActivity; maxRounds?: number }
): Promise<AgentLoopResult> {
  const configs = listLlmConfigs();
  if (!configs.length) {
    throw new Error(
      'No LLM providers configured (set a paid key, a free-tier key, or leave Pollinations enabled)'
    );
  }

  const activities: ToolActivity[] = [];
  const onActivity: OnActivity = a => {
    activities.push(a);
    opts?.onActivity?.(a);
  };

  const operatorNotes = formatOperatorNotes(loadLessons());
  const systemContent = [SYSTEM_PROMPT, operatorNotes, opts?.systemAugment]
    .filter(Boolean)
    .join('\n\n');

  const compiled = buildGraph(configs, onActivity);
  const maxRounds = opts?.maxRounds ?? MAX_TOOL_ROUNDS;
  // Each llm↔tools hop counts; recursionLimit ≈ 2 * rounds + 1
  const recursionLimit = Math.max(4, maxRounds * 2 + 2);

  const result = await compiled.invoke(
    {
      messages: toLcMessages(systemContent, userMessages),
      llmIndex: 0,
      provider: configs[0].provider,
      model: configs[0].model
    },
    { recursionLimit }
  );

  let finalContent = finalAssistantText(result.messages || []);
  if (!finalContent) {
    finalContent =
      activities.length > 0
        ? `Tool rounds completed (${activities.map(a => a.summary).join('; ')}), but no final model text. Check model/tool support.`
        : 'No response from model.';
  }

  return {
    stream: sseStreamFromText(finalContent, activities),
    activities,
    provider: String(result.provider || configs[0].provider),
    model: String(result.model || configs[0].model)
  };
}
