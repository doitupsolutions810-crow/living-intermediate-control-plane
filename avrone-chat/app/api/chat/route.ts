import { fetchLatticeTurn } from '../../../lib/avrone-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json();
  const messages = body.messages || [];
  const last = messages.filter((m: { role: string }) => m.role === 'user').pop();
  const text = last?.content || '';
  const lattice = await fetchLatticeTurn(text, body.belief ?? 0.55);

  const reply =
    `${lattice.systemAugment || ''}\n\n` +
    `(Avrone) Received: ${String(text).slice(0, 500)}\n` +
    (lattice.offline
      ? 'Field offline — responding without live spectrum.'
      : 'Field present — tone shaped by current belief/tension.');

  // Minimal SSE-shaped stream for the UI
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const payload = {
        choices: [{ delta: { content: reply } }]
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-lattice-offline': lattice.offline ? '1' : '0'
    }
  });
}
