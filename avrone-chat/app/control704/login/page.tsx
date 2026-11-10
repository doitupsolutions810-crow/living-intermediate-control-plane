'use client';

import { FormEvent, useState } from 'react';
import { card, input, primaryBtn, Shell } from '../ui';

function safeNext(): string {
  const n = new URLSearchParams(window.location.search).get('next') || '';
  // Only allow internal Control704 paths (no open redirect).
  return /^\/control704(\/[A-Za-z0-9/_-]*)?$/.test(n) && n !== '/control704/login' ? n : '/control704';
}

export default function LoginPage() {
  const [id, setId] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/control704/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: id.trim(), key })
      });
      if (res.ok) {
        setKey('');
        window.location.href = safeNext();
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(
        res.status === 429
          ? 'Too many attempts. Wait a few minutes.'
          : res.status === 503
            ? 'Access layer not configured (AVRONE_AUTH_SECRET).'
            : d.error === 'invalid_credentials'
              ? 'Invalid technician ID or access key.'
              : `Sign-in failed (${res.status}).`
      );
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell subtitle="Technician sign-in">
      <form onSubmit={onSubmit} style={{ ...card, display: 'grid', gap: 12, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Sign in</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          Use your Control704 technician ID and access key. Keys are issued by an admin and never stored in plain text.
        </p>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Technician ID
          <input style={input} value={id} onChange={e => setId(e.target.value)} autoComplete="username" required disabled={busy} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Access key
          <input style={input} type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="current-password" required disabled={busy} />
        </label>
        {error ? <p style={{ margin: 0, color: 'var(--bad)', fontSize: 13 }}>{error}</p> : null}
        <button type="submit" style={primaryBtn} disabled={busy || !id.trim() || !key}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Shell>
  );
}
