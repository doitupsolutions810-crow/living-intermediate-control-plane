'use client';

import { FormEvent, useEffect, useState } from 'react';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export default function Page() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('ready');
  const [cockpit, setCockpit] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/cockpit')
        .then(r => r.json())
        .then(d => {
          if (!cancelled) setCockpit(d);
        })
        .catch(() => {
          if (!cancelled) setCockpit(null);
        });
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setStatus('wiring lattice…');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          belief: 0.55
        })
      });
      const offline = res.headers.get('x-lattice-offline') === '1';
      setStatus(offline ? 'lattice offline' : 'lattice connected');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistant = '';
      setMessages(m => [...m, { role: 'assistant', content: '' }]);
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content || '';
              if (delta) {
                assistant += delta;
                setMessages(m => {
                  const copy = [...m];
                  copy[copy.length - 1] = { role: 'assistant', content: assistant };
                  return copy;
                });
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
      setStatus('done');
    } catch (err) {
      setMessages(m => [
        ...m,
        { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` }
      ]);
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  const platformOk = Boolean((cockpit as { platform?: { ok?: boolean } } | null)?.platform?.ok);
  const severity =
    (cockpit as { anomalies?: { severity?: string } } | null)?.anomalies?.severity || '—';

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui', padding: 16 }}>
      <header>
        <h1>Avrone Due’Krey</h1>
        <p>Living intermediate · lattice-wired chat</p>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          platform={platformOk ? 'up' : 'down'} · severity={severity}
        </p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '1.5rem 0' }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              borderRadius: 8,
              background: m.role === 'user' ? '#1a1a2e' : '#16213e',
              color: '#eee'
            }}
          >
            {m.content}
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Message Avrone…"
          disabled={busy}
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
      <p style={{ fontSize: 12, opacity: 0.6 }}>{status}</p>
    </main>
  );
}
