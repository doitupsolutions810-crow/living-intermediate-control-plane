export function createSseParser(onDelta, onTool) {
  let buffer = '';
  let decoder = new TextDecoder();

  function processLines(final = false) {
    const lines = buffer.split('\n');
    buffer = final ? '' : lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith(': avrone-tool ')) {
        try {
          onTool(JSON.parse(line.slice(': avrone-tool '.length)));
        } catch {
          // Ignore malformed activity metadata and keep parsing answer text.
        }
        continue;
      }
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const payload = JSON.parse(data);
        const delta = payload.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) onDelta(delta);
      } catch {
        // Ignore malformed events; the caller will show a failure if no answer arrives.
      }
    }
  }

  return {
    push(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      processLines();
    },
    finish() {
      buffer += decoder.decode();
      if (buffer) buffer += '\n';
      processLines(true);
    }
  };
}

export async function readSseResponse(response, onDelta, onTool) {
  if (!response.ok) {
    let detail = `Request failed (HTTP ${response.status}).`;
    try {
      const payload = await response.json();
      if (typeof payload.message === 'string' && payload.message.trim()) {
        detail = payload.message;
      } else if (typeof payload.error === 'string') {
        detail = payload.error;
      }
    } catch {
      // Keep the HTTP status as actionable fallback context.
    }
    throw new Error(detail);
  }
  if (!response.body) throw new Error('The server returned no response stream. Try again.');

  const parser = createSseParser(onDelta, onTool);
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(value);
  }
  parser.finish();
}
