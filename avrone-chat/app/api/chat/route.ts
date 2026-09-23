import { fetchLatticeTurn } from '../../../lib/avrone-client';
import {
  resolveLlmConfig,
  runAgentLoop,
  toolsSummaryHeader
} from '../../../lib/agent-loop';
import { tryDeterministicTools } from '../../../lib/agent-tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  // Agent mode: LLM + tools
  if (llm) {
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
          'x-avrone-provider': provider,
          'x-avrone-model': model,
          'x-avrone-tools': toolsSummaryHeader(activities)
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return sseReply(
        `(Avrone agent error) ${msg}\n\nFalling back tip: check XAI_API_KEY / OPENAI_API_KEY and model name.`,
        {
          'x-lattice-offline': lattice.offline ? '1' : '0',
          'x-avrone-agent': '0',
          'x-avrone-tools': '[]'
        }
      );
    }
  }

  // No LLM key: deterministic tool path for explicit intents
  const det = await tryDeterministicTools(String(text));
  if (det?.handled) {
    const tip =
      '\n\n—\nAgent mode needs XAI_API_KEY (preferred) or OPENAI_API_KEY / GROK_API_KEY on Vercel.';
    return sseReply(`${det.reply || ''}${tip}`, {
      'x-lattice-offline': lattice.offline ? '1' : '0',
      'x-avrone-agent': '0',
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
    '\n\n—\nTo enable Grok-class agent tools, set XAI_API_KEY (or OPENAI_API_KEY) in Vercel. ' +
    'Optional: TAVILY_API_KEY for web_search. Explicit cmds work without LLM: ' +
    '`search <q>`, `fetch <url>`, `js: <code>`, `shell: <cmd>`.';

  return sseReply(reply, {
    'x-lattice-offline': lattice.offline ? '1' : '0',
    'x-avrone-agent': '0',
    'x-avrone-tools': '[]'
  });
}
