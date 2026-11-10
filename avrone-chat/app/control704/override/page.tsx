'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, card, dangerBtn, ghostBtn, input, logout, Nav, primaryBtn, RoleBadge, Shell, type Role } from '../ui';

type Session = { sub: string; role: Role };
type Dataset = { name: string; effective: Record<string, unknown> };
type Active = { id: string; dataset: string; key: string; value: unknown; reason: string; actor: string; createdAt: string; expiresAt: string | null };
type Diff = { dataset: string; key: string; before: unknown; after: unknown; expiresAt: string | null };

const pre = { margin: 0, padding: 10, borderRadius: 8, background: 'var(--bg)', fontSize: 12, overflowX: 'auto' as const };

export default function OverridePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [active, setActive] = useState<Active[]>([]);
  const [dataset, setDataset] = useState('');
  const [key, setKey] = useState('');
  const [valueJson, setValueJson] = useState('');
  const [reason, setReason] = useState('');
  const [ttl, setTtl] = useState('');
  const [diff, setDiff] = useState<Diff | null>(null);
  const [previewSig, setPreviewSig] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const sig = JSON.stringify([dataset, key, valueJson, reason, ttl]);
  const isAdmin = session?.role === 'admin';

  async function refresh() {
    const [s, o] = await Promise.all([
      api<Session>('/api/control704/session'),
      api<{ datasets: Dataset[]; active: Active[] }>('/api/control704/override')
    ]);
    if (s.status === 200) setSession(s.data);
    if (o.status === 200) {
      setDatasets(o.data.datasets);
      setActive(o.data.active);
      setDataset(d => d || o.data.datasets[0]?.name || '');
    } else if (o.status === 403) {
      setMsg('Your role cannot view datasets (technician or admin required).');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function payload(dryRun: boolean) {
    let value: unknown;
    try {
      value = JSON.parse(valueJson);
    } catch {
      throw new Error('Value must be valid JSON (wrap strings in quotes).');
    }
    return { dataset, key, value, reason, ttlMinutes: ttl ? Number(ttl) : undefined, dryRun, confirm: dryRun ? undefined : confirm };
  }

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setDiff(null);
    setConfirm(false);
    try {
      setBusy(true);
      const r = await api<{ ok: boolean; diff?: Diff; error?: string; detail?: string }>('/api/control704/override', {
        method: 'POST',
        body: JSON.stringify(payload(true))
      });
      if (r.data?.ok && r.data.diff) {
        setDiff(r.data.diff);
        setPreviewSig(sig);
      } else setMsg(`${r.data?.error || r.status}${r.data?.detail ? ` — ${r.data.detail}` : ''}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onApply() {
    setMsg('');
    try {
      setBusy(true);
      const r = await api<{ ok: boolean; record?: Active; error?: string; detail?: string }>('/api/control704/override', {
        method: 'POST',
        body: JSON.stringify(payload(false))
      });
      if (r.data?.ok) {
        setMsg(`Applied override ${r.data.record?.id}. Audited.`);
        setDiff(null);
        setConfirm(false);
        await refresh();
      } else setMsg(`${r.data?.error || r.status}${r.data?.detail ? ` — ${r.data.detail}` : ''}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRevert(id: string) {
    const why = window.prompt('Reason for revert (10+ chars):') || '';
    if (!why) return;
    const r = await api<{ ok: boolean; error?: string }>('/api/control704/override', {
      method: 'POST',
      body: JSON.stringify({ op: 'revert', id, reason: why })
    });
    setMsg(r.data?.ok ? `Reverted ${id}.` : `Revert failed: ${r.data?.error || r.status}`);
    await refresh();
  }

  const canApply = isAdmin && diff && previewSig === sig && confirm && !busy;

  return (
    <Shell
      subtitle="Dataset code override · break-glass (admin)"
      right={
        <>
          <Nav current="override" />
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
      {!isAdmin && session ? (
        <div style={{ ...card, borderColor: 'var(--warn)', color: 'var(--warn)', fontSize: 13 }}>
          Read-only: applying overrides requires the admin role.
        </div>
      ) : null}

      <form onSubmit={onPreview} style={{ ...card, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>1 · Describe the override</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Dataset
            <select style={input} value={dataset} onChange={e => setDataset(e.target.value)} disabled={!isAdmin}>
              {datasets.map(d => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Key (dotted)
            <input style={input} value={key} onChange={e => setKey(e.target.value)} placeholder="code or flags.mode" disabled={!isAdmin} required />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Expiry (minutes, optional)
            <input style={input} value={ttl} onChange={e => setTtl(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 60" disabled={!isAdmin} />
          </label>
        </div>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          New value (JSON)
          <textarea style={{ ...input, minHeight: 70, fontFamily: 'ui-monospace, monospace' }} value={valueJson} onChange={e => setValueJson(e.target.value)} placeholder={'"ABC123"  or  {"enabled": true}'} disabled={!isAdmin} required />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Reason (required, 10+ chars — recorded in the audit log)
          <input style={input} value={reason} onChange={e => setReason(e.target.value)} disabled={!isAdmin} required minLength={10} />
        </label>
        <button type="submit" style={{ ...primaryBtn, justifySelf: 'start' }} disabled={!isAdmin || busy}>
          Preview (dry run)
        </button>
      </form>

      {diff ? (
        <section style={{ ...card, display: 'grid', gap: 10, borderColor: 'var(--warn)' }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>2 · Review diff</h2>
          <div style={{ fontSize: 13 }}>
            <code>
              {diff.dataset}:{diff.key}
            </code>{' '}
            · expires {diff.expiresAt ? new Date(diff.expiresAt).toLocaleString() : 'never'}
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--bad)', marginBottom: 4 }}>− before</div>
              <pre style={pre}>{diff.before === undefined ? '(unset)' : JSON.stringify(diff.before, null, 2)}</pre>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ok)', marginBottom: 4 }}>+ after</div>
              <pre style={pre}>{JSON.stringify(diff.after, null, 2)}</pre>
            </div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />I confirm this break-glass override and its reason.
          </label>
          {previewSig !== sig ? <p style={{ margin: 0, fontSize: 12, color: 'var(--warn)' }}>Inputs changed since preview — preview again.</p> : null}
          <button type="button" style={{ ...dangerBtn, justifySelf: 'start' }} disabled={!canApply} onClick={onApply}>
            3 · Apply override
          </button>
        </section>
      ) : null}

      {msg ? <div style={{ ...card, fontSize: 13 }}>{msg}</div> : null}

      <section style={{ ...card, display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Active overrides</h2>
        {active.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>None.</p> : null}
        {active.map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-assistant)' }}>
            <span>
              <code>
                {a.dataset}:{a.key}
              </code>{' '}
              = <code>{JSON.stringify(a.value)}</code> · {a.actor} · {a.reason}
              {a.expiresAt ? ` · until ${new Date(a.expiresAt).toLocaleString()}` : ''}
            </span>
            {isAdmin ? (
              <button style={ghostBtn} onClick={() => onRevert(a.id)}>
                Revert
              </button>
            ) : null}
          </div>
        ))}
      </section>
    </Shell>
  );
}
