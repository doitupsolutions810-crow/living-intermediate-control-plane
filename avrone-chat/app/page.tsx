'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRegistrySnapshot } from '../lib/avrone-client';
import {
  conversationTitle,
  readHistory,
  writeHistory
} from '../lib/chat-history.mjs';
import { readSseResponse } from '../lib/chat-stream.mjs';

type ChatMsg = { role: 'user' | 'assistant'; content: string; status?: 'stopped' };
type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  latticeSessionId: string | null;
  messages: ChatMsg[];
};

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
  componentRegistry?: ComponentRegistrySnapshot;
};

function statusTone(ok: boolean | undefined, configured: boolean | undefined) {
  if (!configured) return 'var(--warn)';
  return ok ? 'var(--ok)' : 'var(--bad)';
}

function newConversation(): Conversation {
  const now = new Date().toISOString();
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    latticeSessionId: null,
    messages: []
  };
}

export default function Page() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('ready');
  const [failure, setFailure] = useState<{ conversationId: string; message: string } | null>(null);
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const restored = readHistory(window.localStorage);
      if (restored.invalidCount) {
        setStorageNotice(
          'Some saved chat history was invalid and could not be restored. New chats can still be saved.'
        );
      }
      const list = restored.conversations as Conversation[];
      if (list.length) {
        setConversations(list);
        setSelectedId(list[0].id);
      } else {
        const fresh = newConversation();
        setConversations([fresh]);
        setSelectedId(fresh.id);
      }
    } catch {
      const fresh = newConversation();
      setConversations([fresh]);
      setSelectedId(fresh.id);
      setStorageError('Chat history could not be read from this browser. Check storage permissions.');
    } finally {
      setHistoryReady(true);
    }
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    try {
      const saved = writeHistory(window.localStorage, conversations);
      setStorageError(current => (current ? '' : current));
      if (saved.length !== conversations.length) {
        setConversations(saved as Conversation[]);
      }
    } catch {
      setStorageError('Chat history could not be saved. Check browser storage availability and space.');
    }
  }, [conversations, historyReady]);

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
    const timer = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const selectedConversation = conversations.find(conversation => conversation.id === selectedId);
  const messages = selectedConversation?.messages ?? [];
  const visibleFailure =
    failure && failure.conversationId === selectedConversation?.id ? failure.message : '';

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

  function updateConversation(id: string, update: (conversation: Conversation) => Conversation) {
    setConversations(current =>
      current.map(conversation => (conversation.id === id ? update(conversation) : conversation))
    );
  }

  function addConversation() {
    if (busy) return;
    const fresh = newConversation();
    setConversations(current => [fresh, ...current]);
    setSelectedId(fresh.id);
    setFailure(null);
    setStatus('ready');
  }

  async function requestAssistant(
    conversationId: string,
    transcript: ChatMsg[],
    latticeSessionId: string | null
  ) {
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setBusy(true);
    setFailure(null);
    setStatus('Avrone thinking…');
    let assistant = '';
    updateConversation(conversationId, conversation => ({
      ...conversation,
      updatedAt: new Date().toISOString(),
      messages: [...conversation.messages, { role: 'assistant', content: '' }]
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: transcript.map(message => ({ role: message.role, content: message.content })),
          belief: 0.55,
          latticeSessionId
        })
      });

      const offline = response.headers.get('x-lattice-offline') === '1';
      const nextSessionId = response.headers.get('x-lattice-session-id');
      if (nextSessionId || offline) {
        updateConversation(conversationId, conversation => ({
          ...conversation,
          latticeSessionId: nextSessionId || null
        }));
      }

      const provider = response.headers.get('x-avrone-provider');
      const model = response.headers.get('x-avrone-model');
      const engine = response.headers.get('x-avrone-engine');
      const toolSummaries: string[] = [];
      try {
        const parsed = JSON.parse(response.headers.get('x-avrone-tools') || '[]') as Array<{
          summary?: string;
          name?: string;
        }>;
        toolSummaries.push(...parsed.map(tool => tool.summary || tool.name || 'tool'));
      } catch {
        // The metadata header is optional; the response body remains authoritative.
      }

      await readSseResponse(
        response,
        (delta: string) => {
          assistant += delta;
          updateConversation(conversationId, conversation => {
            const updated = [...conversation.messages];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') updated[updated.length - 1] = { role: 'assistant', content: assistant };
            return { ...conversation, messages: updated, updatedAt: new Date().toISOString() };
          });
        },
        (activity: { summary?: string; name?: string }) => {
          toolSummaries.push(activity.summary || activity.name || 'tool');
          setStatus(`agent · ${toolSummaries.slice(-4).join(' · ')}`);
        }
      );

      if (!assistant.trim()) {
        throw new Error('The provider returned no answer text. Check the configured model and try again.');
      }
      const resultLabel = provider && model ? `${provider} · ${model}` : engine || 'done';
      setStatus(toolSummaries.length ? `done · ${resultLabel} · ${toolSummaries.slice(-3).join(' · ')}` : `done · ${resultLabel}`);
    } catch (error) {
      if (controller.signal.aborted) {
        updateConversation(conversationId, conversation => {
          const updated = [...conversation.messages];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            if (assistant) updated[updated.length - 1] = { role: 'assistant', content: assistant, status: 'stopped' };
            else updated.pop();
          }
          return { ...conversation, messages: updated, updatedAt: new Date().toISOString() };
        });
        setStatus(assistant ? 'response stopped · partial answer kept' : 'response stopped');
      } else {
        const message = error instanceof Error ? error.message : String(error);
        updateConversation(conversationId, conversation => {
          const updated = [...conversation.messages];
          if (updated.at(-1)?.role === 'assistant' && !assistant) updated.pop();
          return { ...conversation, messages: updated, updatedAt: new Date().toISOString() };
        });
        setFailure({ conversationId, message });
        setStatus('request failed');
      }
    } finally {
      if (activeRequestRef.current === controller) activeRequestRef.current = null;
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || !selectedConversation) return;
    const userMessage: ChatMsg = { role: 'user', content: text };
    const transcript = [...selectedConversation.messages, userMessage];
    const updatedAt = new Date().toISOString();
    updateConversation(selectedConversation.id, conversation => ({
      ...conversation,
      title: conversationTitle(transcript),
      updatedAt,
      messages: transcript
    }));
    setInput('');
    await requestAssistant(
      selectedConversation.id,
      transcript,
      selectedConversation.latticeSessionId
    );
  }

  async function retryLastTurn() {
    if (busy || !selectedConversation || !visibleFailure) return;
    const transcript = [...selectedConversation.messages];
    if (transcript.at(-1)?.role === 'assistant') transcript.pop();
    const lastUserIndex = transcript.map(message => message.role).lastIndexOf('user');
    if (lastUserIndex < 0) return;
    const retryTranscript = transcript.slice(0, lastUserIndex + 1);
    updateConversation(selectedConversation.id, conversation => ({
      ...conversation,
      messages: retryTranscript,
      updatedAt: new Date().toISOString()
    }));
    await requestAssistant(
      selectedConversation.id,
      retryTranscript,
      selectedConversation.latticeSessionId
    );
  }

  const recentConversations = [...conversations].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-main">
          <div>
            <h1 className="app-title">Avrone Due’Krey</h1>
            <p className="app-subtitle">Living intermediate · lattice-wired chat</p>
          </div>
          <div className="platform-status" aria-label="Platform status">
            <span>
              platform:{' '}
              <strong style={{ color: statusTone(platformOk, platformConfigured) }}>
                {!platformConfigured ? 'unconfigured' : platformOk ? 'up' : 'down'}
              </strong>
            </span>
            <span>severity: <strong>{severity}</strong></span>
            <span>evidence: <strong>{evidenceLabel}</strong></span>
          </div>
        </div>
        {evidence?.note ? <p className="evidence-note">{evidence.note}</p> : null}
      </header>

      <details className="registry-panel">
        <summary>Registered platform components</summary>
        <div className="registry-content">
          <p className="panel-caption">
            Local registry entries only; registration is not cross-repository verification.
          </p>
          {cockpit?.componentRegistry?.status === 'available' ? (
            cockpit.componentRegistry.components.length ? (
              <ul className="component-list">
                {cockpit.componentRegistry.components.map(component => (
                  <li key={component.id}>
                    <strong>{component.id}</strong>
                    {component.kind ? ` · ${component.kind}` : ''}
                    {component.version ? ` · v${component.version}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-copy">No components registered.</p>
            )
          ) : (
            <p className="registry-warning">
              {cockpit?.componentRegistry?.status === 'unavailable' ? (
                cockpit.componentRegistry.error
                  ? `Registry unavailable: ${cockpit.componentRegistry.error}`
                  : `Registry unavailable${cockpit.componentRegistry.httpStatus ? ` (HTTP ${cockpit.componentRegistry.httpStatus})` : ''}.`
              ) : cockpit?.componentRegistry?.status === 'invalid' ? (
                'Registry returned invalid component data.'
              ) : (
                'Loading component registry…'
              )}
            </p>
          )}
        </div>
      </details>

      <section className="chat-layout" aria-label="Chat">
        <aside className="conversation-sidebar" aria-label="Conversation history">
          <div className="history-heading">
            <h2>Recent chats</h2>
            <button type="button" className="new-chat-button" onClick={addConversation} disabled={busy}>
              New chat
            </button>
          </div>
          <nav className="conversation-list" aria-label="Select a conversation">
            {recentConversations.map(conversation => (
              <button
                type="button"
                key={conversation.id}
                className={`conversation-item${conversation.id === selectedId ? ' selected' : ''}`}
                aria-current={conversation.id === selectedId ? 'page' : undefined}
                onClick={() => {
                  if (busy) return;
                  setSelectedId(conversation.id);
                  setStatus('ready');
                }}
                disabled={busy}
              >
                <span className="conversation-title">{conversation.title}</span>
                <span className="conversation-date">
                  {conversation.messages.length ? new Date(conversation.updatedAt).toLocaleDateString() : 'Empty'}
                </span>
              </button>
            ))}
          </nav>
          {storageNotice ? <p className="storage-message warning">{storageNotice}</p> : null}
          {storageError ? <p className="storage-message error" role="alert">{storageError}</p> : null}
        </aside>

        <div className="chat-panel">
          <div className="chat-messages" role="log" aria-label="Conversation messages" aria-live="polite">
            {!messages.length ? (
              <div className="empty-chat">
                <h2>What would you like to work through?</h2>
                <p>Ask Avrone a question, or use an available agent tool. Your conversation stays in this browser.</p>
              </div>
            ) : null}
            {messages.map((message, index) => (
              <article
                key={`${selectedConversation?.id}-${index}`}
                className={`message ${message.role === 'user' ? 'message-user' : 'message-assistant'}`}
              >
                <div className="message-label">{message.role === 'user' ? 'you' : 'avrone'}</div>
                <div className="message-content">{message.content || (busy && index === messages.length - 1 ? '…' : '')}</div>
                {message.status === 'stopped' ? <div className="message-state">Stopped · partial response</div> : null}
              </article>
            ))}
            <div ref={bottomRef} />
          </div>
          {visibleFailure ? (
            <div className="chat-error" role="alert">
              <div>
                <strong>Avrone couldn’t complete that turn.</strong>
                <p>{visibleFailure}</p>
              </div>
              <button type="button" onClick={retryLastTurn} disabled={busy}>Retry</button>
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="composer">
            <label className="visually-hidden" htmlFor="chat-input">Message Avrone</label>
            <input
              id="chat-input"
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="Message Avrone…"
              disabled={busy || !historyReady}
            />
            {busy ? (
              <button type="button" className="stop-button" onClick={() => activeRequestRef.current?.abort()}>
                Stop generating
              </button>
            ) : (
              <button type="submit" className="send-button" disabled={!input.trim() || !selectedConversation}>
                Send
              </button>
            )}
          </form>
          <p className="chat-status" aria-live="polite">{status}</p>
        </div>
      </section>
    </main>
  );
}
