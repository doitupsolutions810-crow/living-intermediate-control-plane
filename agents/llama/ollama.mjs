/**
 * Minimal Ollama chat client
 */

export async function ollamaChat({ baseUrl, model, messages, timeoutMs = 120000 }) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    const data = await res.json();
    return data?.message?.content || '';
  } finally {
    clearTimeout(t);
  }
}

export async function ollamaTags(baseUrl) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);
  if (!res.ok) throw new Error(`Ollama tags HTTP ${res.status}`);
  return res.json();
}
