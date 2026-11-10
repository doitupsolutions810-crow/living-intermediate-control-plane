'use client';

import type { CSSProperties, ReactNode } from 'react';

export type Role = 'viewer' | 'technician' | 'admin';

export const card: CSSProperties = {
  padding: 16,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-elevated)'
};

export const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)'
};

export const primaryBtn: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid transparent',
  background: 'var(--accent-strong)',
  color: '#061018',
  fontWeight: 600
};

export const ghostBtn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)'
};

export const dangerBtn: CSSProperties = { ...primaryBtn, background: 'var(--bad)', color: '#1a0606' };

const ROLE_TONE: Record<Role, string> = {
  viewer: 'var(--muted)',
  technician: 'var(--accent)',
  admin: 'var(--warn)'
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '3px 8px',
        borderRadius: 999,
        border: `1px solid ${ROLE_TONE[role]}`,
        color: ROLE_TONE[role]
      }}
    >
      {role}
    </span>
  );
}

export function Shell({
  children,
  right,
  subtitle = 'IT Technician access · Control12-lattice-op'
}: {
  children: ReactNode;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '2rem 1rem 3rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: '100vh'
      }}
    >
      <header style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Avrone Due’Krey
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 26, letterSpacing: '-0.02em' }}>Control704</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{right}</div>
      </header>
      {children}
      <footer style={{ fontSize: 12, color: 'var(--muted)' }}>
        <a href="/">← Avrone chat</a> · every proxy call and override is written to the append-only audit log
      </footer>
    </main>
  );
}

export function Nav({ current }: { current: 'dashboard' | 'override' }) {
  const link = (href: string, label: string, on: boolean) => (
    <a
      href={href}
      style={{ ...ghostBtn, textDecoration: 'none', borderColor: on ? 'var(--accent)' : 'var(--border)', color: on ? 'var(--accent)' : 'var(--text)' }}
    >
      {label}
    </a>
  );
  return (
    <>
      {link('/control704', 'Dashboard', current === 'dashboard')}
      {link('/control704/override', 'Override', current === 'override')}
    </>
  );
}

export async function logout() {
  await fetch('/api/control704/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/control704/login';
}

export async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store'
  });
  if (res.status === 401) {
    window.location.href = `/control704/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data: data as T };
}
