'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

type Cockpit = {
  service?: string;
  observedAt?: string;
  platformConfigured?: boolean;
  platform?: { ok?: boolean; error?: string };
  anomalies?: { severity?: string } | null;
  evidenceConsole?: {
    status?: string;
    httpStatus?: number | null;
    authority?: string;
    note?: string;
  };
};

function statusTone(ok: boolean | undefined, configured: boolean | undefined) {
  if (!configured) return 'var(--warn)';
  return ok ? 'var(--ok)' : 'var(--bad)';
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content:
        'Avrone online. Lattice-wired chat is ready. Ask for plane status, readiness, or next actions.'
    }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('ready');
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const platformOk = Boolean(cockpit?.platform?.ok);
  const platformConfigured = Boolean(cockpit?.platformConfigured);
  const severity = cockpit?.anomalies?.severity || '—';
  const evidence = cockpit?.evidenceConsole;

  const evidenceLabel = useMemo(() => {
    if (!evidence?.status) return 'unchecked';
    if (evidence.status === 'ok') return 'public ok';
    if (evidence.status === 'not_found') return 'public 404 → local';
    if (evidence.status === 'unreachable') return 'unreachable → local';
    if (evidence.status === 'unconfigured') return 'url unset → local';
    return evidence.status;
  }, [evidence]);

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
              /* ignore partial SSE */
            }
          }
        }
      }
      if (!assistant) {
        setMessages(m => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: 'No stream payload returned. Check platform URL / token.'
          };
          return copy;
        });
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

  return (
    <main
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: '2rem 1rem 3rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: '100vh'
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 16,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--bg-elevated)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-0.02em' }}>Avrone Due’Krey</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
              Living intermediate · lattice-wired chat
            </p>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              display: 'grid',
              gap: 4,
              alignContent: 'start'
            }}
          >
            <span>
              platform:{' '}
              <strong style={{ color: statusTone(platformOk, platformConfigured) }}>
                {!platformConfigured ? 'unconfigured' : platformOk ? 'up' : 'down'}
              </strong>
            </span>
            <span>
              severity: <strong style={{ color: 'var(--text)' }}>{severity}</strong>
            </span>
            <span>
              evidence: <strong style={{ color: 'var(--text)' }}>{evidenceLabel}</strong>
            </span>
          </div>
        </div>
        {evidence?.note ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{evidence.note}</p>
        ) : null}
      </header>

      <section
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 12,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'rgba(18, 22, 31, 0.72)',
          minHeight: 360
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: m.role === 'user' ? 'var(--bg-user)' : 'var(--bg-assistant)',
              border: '1px solid var(--border)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.45,
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '92%'
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
              {m.role === 'user' ? 'you' : 'avrone'}
            </div>
            {m.content || (busy && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
        <div ref={bottomRef} />
      </section>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Message Avrone…"
          disabled={busy}
          aria-label="Message"
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            color: 'var(--text)'
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            padding: '12px 18px',
            borderRadius: 10,
            border: '1px solid transparent',
            background: 'var(--accent-strong)',
            color: '#061018',
            fontWeight: 600
          }}
        >
          Send
        </button>
      </form>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{status}</p>
    </main>
  );
}
