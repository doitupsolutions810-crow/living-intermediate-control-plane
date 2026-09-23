import { fetchLatticeTurn } from '../../../lib/avrone-client';
import {
  resolveLlmConfig,
  runAgentLoop,
  toolsSummaryHeader
} from '../../../lib/agent-loop';
import { tryDeterministicTools } from '../../../lib/agent-tools';
import {
  isLangGraphEnabled,
  runLangGraphAgent
} from '../../../lib/langgraph-agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function sseReply(text: string, extraHeaders?: Record<string, string>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const payload = { choices: [{ delta: { content: text } }] };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

export async function POST(req: Request) {
  let body: { messages?: Array<{ role: string; content?: string }>; belief?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const messages = body.messages || [];
  const last = messages.filter(m => m.role === 'user').pop();
  const text = last?.content || '';
  const lattice = await fetchLatticeTurn(String(text), body.belief ?? 0.55);

  const llm = resolveLlmConfig();

  // Agent mode: LLM + tools (LangGraph preferred when enabled)
  if (llm) {
    const useLangGraph = isLangGraphEnabled();
    if (useLangGraph) {
      try {
        const { stream, activities, provider, model } = await runLangGraphAgent(messages, {
          systemAugment: lattice.systemAugment
        });
        return new Response(stream, {
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-store',
            'x-lattice-offline': lattice.offline ? '1' : '0',
            'x-avrone-agent': 'langgraph',
            'x-avrone-engine': 'langgraph',
            'x-avrone-provider': provider,
            'x-avrone-model': model,
            'x-avrone-tools': toolsSummaryHeader(activities)
          }
        });
      } catch (err) {
        // LangGraph failed — fall through to classic runAgentLoop
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[avrone] LangGraph path failed, falling back to agent-loop:', msg.slice(0, 300));
      }
    }

    try {
      const { stream, activities, provider, model } = await runAgentLoop(messages, {
        systemAugment: lattice.systemAugment
      });
      return new Response(stream, {
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-store',
          'x-lattice-offline': lattice.offline ? '1' : '0',
          'x-avrone-agent': '1',
          'x-avrone-engine': 'classic',
          'x-avrone-provider': provider,
          'x-avrone-model': model,
          'x-avrone-tools': toolsSummaryHeader(activities)
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return sseReply(
        `(Avrone agent error) ${msg}\n\nFalling back tip: check LLM keys / Pollinations (AVRONE_POLLINATIONS_ENABLED) and model names.`,
        {
          'x-lattice-offline': lattice.offline ? '1' : '0',
          'x-avrone-agent': '0',
          'x-avrone-engine': 'error',
          'x-avrone-tools': '[]'
        }
      );
    }
  }

  // No LLM key: deterministic tool path for explicit intents
  const det = await tryDeterministicTools(String(text));
  if (det?.handled) {
    const tip =
      '\n\n—\nAgent mode needs an LLM provider (paid key, free-tier key, or Pollinations).';
    return sseReply(`${det.reply || ''}${tip}`, {
      'x-lattice-offline': lattice.offline ? '1' : '0',
      'x-avrone-agent': '0',
      'x-avrone-engine': 'deterministic',
      'x-avrone-tools': toolsSummaryHeader(det.activities)
    });
  }

  // Classic lattice echo
  const reply =
    `${lattice.systemAugment || ''}\n\n` +
    `(Avrone) Received: ${String(text).slice(0, 500)}\n` +
    (lattice.offline
      ? 'Field offline — responding without live spectrum.'
      : 'Field present — tone shaped by current belief/tension.') +
    '\n\n—\nTo enable agent tools, set a paid/free LLM key or leave Pollinations enabled. ' +
    'Optional: TAVILY_API_KEY for web_search. Explicit cmds work without LLM: ' +
    '`search <q>`, `fetch <url>`, `js: <code>`, `shell: <cmd>`.';

  return sseReply(reply, {
    'x-lattice-offline': lattice.offline ? '1' : '0',
    'x-avrone-agent': '0',
    'x-avrone-engine': 'lattice',
    'x-avrone-tools': '[]'
  });
}
