'use client';

import { useEffect, useState } from 'react';
import { api, card, ghostBtn, logout, Nav, RoleBadge, Shell, type Role } from './ui';

type Session = { sub: string; role: Role; expiresAt: string };
type Target = {
  id: string;
  label: string;
  authMode: string;
  configured: boolean;
  status: string;
  host: string | null;
  credentialInjected: boolean;
  yourAccess: { methods: string[]; paths: string[] } | null;
};
type AuditEntry = { seq: number; ts: string; actor: string; role: string; action: string; target?: string; outcome: string; reason?: string };

const OUTCOME_TONE: Record<string, string> = { ok: 'var(--ok)', denied: 'var(--bad)', error: 'var(--bad)', preview: 'var(--accent)' };

export default function Control704Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [s, t, a] = await Promise.all([
        api<Session>('/api/control704/session'),
        api<{ targets: Target[] }>('/api/control704/targets'),
        api<{ entries: AuditEntry[]; chain: { ok: boolean } }>('/api/control704/audit?limit=15')
      ]);
      if (!alive) return;
      if (s.status === 200) setSession(s.data);
      if (t.status === 200) setTargets(t.data.targets);
      if (a.status === 200) {
        setAudit(a.data.entries);
        setChainOk(a.data.chain?.ok ?? null);
      }
    };
    load();
    const iv = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <Shell
      right={
        <>
          <Nav current="dashboard" />
          {session ? (
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              {session.sub} <RoleBadge role={session.role} />
            </span>
          ) : null}
          <button style={ghostBtn} onClick={logout}>
            Sign out
          </button>
        </>
      }
    >
      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {targets.map(t => (
          <div key={t.id} style={{ ...card, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 18 }}>{t.label}</strong>
              <span style={{ fontSize: 12, color: t.configured ? 'var(--ok)' : 'var(--warn)' }}>{t.status}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'grid', gap: 4 }}>
              <span>auth mode: {t.authMode}</span>
              <span>upstream: {t.host || '—'}</span>
              <span>credential: {t.credentialInjected ? 'injected server-side' : 'none'}</span>
              <span>route: /api/proxy/{t.id}/…</span>
              {t.yourAccess ? (
                <span>
                  your access: {t.yourAccess.methods.join(', ') || 'none'} on {t.yourAccess.paths.join(', ')}
                </span>
              ) : null}
            </div>
          </div>
        ))}
        {!targets.length ? <div style={card}>Loading targets…</div> : null}
      </section>

      <section style={{ ...card, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Recent audit</h2>
          <span style={{ fontSize: 12, color: chainOk === false ? 'var(--bad)' : 'var(--muted)' }}>
            chain: {chainOk === null ? '—' : chainOk ? 'verified' : 'BROKEN'}
          </span>
        </div>
        {audit.length === 0 ? <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>No entries on this instance yet.</p> : null}
        <div style={{ display: 'grid', gap: 6 }}>
          {audit.map(e => (
            <div
              key={e.seq}
              style={{ display: 'grid', gridTemplateColumns: '170px 1fr auto', gap: 10, fontSize: 12, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-assistant)' }}
            >
              <span style={{ color: 'var(--muted)' }}>{new Date(e.ts).toLocaleString()}</span>
              <span>
                <strong>{e.action}</strong> {e.target ? <code>{e.target}</code> : null} · {e.actor} ({e.role})
                {e.reason ? <span style={{ color: 'var(--muted)' }}> — {e.reason}</span> : null}
              </span>
              <span style={{ color: OUTCOME_TONE[e.outcome] || 'var(--text)' }}>{e.outcome}</span>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
