import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

/** Transpile lib/control704/*.ts (except LangChain tool wrappers) into a temp CJS dir. */
function loadControl704() {
  const dir = mkdtempSync(join(tmpdir(), 'c704-'));
  const src = join(root, 'lib/control704');
  for (const f of readdirSync(src)) {
    if (!f.endsWith('.ts') || f === 'agent-tools.ts') continue;
    let out = ts.transpileModule(readFileSync(join(src, f), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: f
    }).outputText;
    out = out.replace(/require\(["']\.\/([a-z0-9-]+)["']\)/g, 'require("./$1.cjs")');
    writeFileSync(join(dir, f.replace(/\.ts$/, '.cjs')), out);
  }
  const mod = name => require(join(dir, `${name}.cjs`));
  return {
    dir,
    roles: mod('roles'),
    session: mod('session'),
    accounts: mod('accounts'),
    audit: mod('audit'),
    targets: mod('targets'),
    proxy: mod('proxy'),
    override: mod('override'),
    guard: mod('guard'),
    ratelimit: mod('ratelimit')
  };
}

const SECRET = 'test-secret-'.padEnd(48, 'x');
let C;
let adminKey, techKey, viewerKey;

before(() => {
  const tmp = mkdtempSync(join(tmpdir(), 'c704-state-'));
  process.env.AVRONE_AUTH_SECRET = SECRET;
  process.env.CONTROL704_AUDIT_PATH = join(tmp, 'audit.jsonl');
  process.env.CONTROL704_OVERRIDE_PATH = join(tmp, 'overrides.json');
  C = loadControl704();
  const fast = { N: 1024 };
  adminKey = C.accounts.generateAccessKey();
  techKey = C.accounts.generateAccessKey();
  viewerKey = C.accounts.generateAccessKey();
  process.env.CONTROL704_ACCOUNTS = JSON.stringify([
    { id: 'jean', role: 'admin', keyHash: C.accounts.hashAccessKey(adminKey, fast) },
    { id: 'tech1', role: 'technician', keyHash: C.accounts.hashAccessKey(techKey, fast) },
    { id: 'view1', role: 'viewer', keyHash: C.accounts.hashAccessKey(viewerKey, fast) },
    { id: 'gone', role: 'admin', keyHash: C.accounts.hashAccessKey('x', fast), disabled: true },
    { id: 'bad', role: 'superuser', keyHash: 'scrypt$1$1$1$a$b' },
    { id: 'raw', role: 'admin', keyHash: 'plaintext' }
  ]);
});

describe('control704 roles', () => {
  it('orders viewer < technician < admin', () => {
    assert.equal(C.roles.hasRole('admin', 'technician'), true);
    assert.equal(C.roles.hasRole('technician', 'admin'), false);
    assert.equal(C.roles.hasRole('viewer', 'viewer'), true);
    assert.equal(C.roles.hasRole(undefined, 'viewer'), false);
    assert.equal(C.roles.hasRole('root', 'viewer'), false);
    assert.equal(C.roles.minRole('admin', 'viewer'), 'viewer');
  });
});

describe('control704 auth: session tokens', () => {
  it('signs and verifies', async () => {
    const t = await C.session.signSession('jean', 'admin');
    const p = await C.session.verifySession(t);
    assert.equal(p.sub, 'jean');
    assert.equal(p.role, 'admin');
  });

  it('rejects tampered payload / signature', async () => {
    const t = await C.session.signSession('tech1', 'technician');
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), role: 'admin' })).toString('base64url');
    assert.equal(await C.session.verifySession(`${forged}.${sig}`), null);
    assert.equal(await C.session.verifySession(`${body}.${sig.slice(0, -2)}AA`), null);
    assert.equal(await C.session.verifySession('garbage'), null);
    assert.equal(await C.session.verifySession(''), null);
  });

  it('rejects expired tokens and other secrets', async () => {
    const old = await C.session.signSession('jean', 'admin', { ttlS: 300, now: Date.now() - 3600_000 });
    assert.equal(await C.session.verifySession(old), null);
    const other = await C.session.signSession('jean', 'admin', { secret: 'another-secret'.padEnd(40, 'y') });
    assert.equal(await C.session.verifySession(other), null);
  });

  it('fails closed when secret missing or short', async () => {
    const t = await C.session.signSession('jean', 'admin');
    const saved = process.env.AVRONE_AUTH_SECRET;
    process.env.AVRONE_AUTH_SECRET = 'short';
    try {
      assert.equal(await C.session.verifySession(t), null);
      await assert.rejects(() => C.session.signSession('jean', 'admin'));
    } finally {
      process.env.AVRONE_AUTH_SECRET = saved;
    }
  });

  it('cookie is HttpOnly, Secure, SameSite=Strict', () => {
    const h = C.session.sessionCookieHeader('abc', 60);
    assert.match(h, /HttpOnly/);
    assert.match(h, /Secure/);
    assert.match(h, /SameSite=Strict/);
  });
});

describe('control704 auth: accounts', () => {
  it('stores scrypt hashes, never the key', () => {
    const h = C.accounts.hashAccessKey('k-123', { N: 1024 });
    assert.match(h, /^scrypt\$1024\$8\$1\$/);
    assert.ok(!h.includes('k-123'));
    assert.equal(C.accounts.verifyAccessKey('k-123', h), true);
    assert.equal(C.accounts.verifyAccessKey('k-124', h), false);
  });

  it('skips invalid and disabled accounts', () => {
    const ids = C.accounts.loadAccounts().map(a => a.id);
    assert.deepEqual(ids, ['jean', 'tech1', 'view1', 'gone']);
    assert.equal(C.accounts.findAccount('gone'), null);
  });

  it('authenticates id + key', () => {
    assert.equal(C.accounts.authenticate('jean', adminKey).role, 'admin');
    assert.equal(C.accounts.authenticate('JEAN', adminKey).id, 'jean');
    assert.equal(C.accounts.authenticate('jean', techKey), null);
    assert.equal(C.accounts.authenticate('nobody', adminKey), null);
    assert.equal(C.accounts.authenticate('gone', 'x'), null);
  });

  it('guard re-checks account and downgrades role', async () => {
    const tok = await C.session.signSession('tech1', 'admin'); // stale/elevated claim
    const c = await C.guard.sessionFromCookieHeader(`a=b; c704_session=${encodeURIComponent(tok)}`);
    assert.equal(c.role, 'technician');
    const ghost = await C.session.signSession('removed-user', 'admin');
    assert.equal(await C.guard.sessionFromCookieHeader(`c704_session=${ghost}`), null);
    assert.equal(await C.guard.sessionFromCookieHeader(null), null);
  });
});

describe('control704 proxy targets + allowlist', () => {
  beforeEach(() => {
    for (const k of Object.keys(process.env)) if (k.startsWith('CONTROL704_PROXY_')) delete process.env[k];
    C.ratelimit.resetRateLimits();
  });

  it('unset upstream => not configured => 503', async () => {
    const t = C.targets.loadTarget('x');
    assert.equal(t.configured, false);
    assert.equal(C.targets.describeTarget(t).status, 'not configured');
    assert.equal(t.label, 'X · token-override');
    const r = await C.proxy.proxyRequest({ target: 'x', method: 'GET', segments: ['status'], actor: { sub: 'jean', role: 'admin' } }, async () => {
      throw new Error('must not fetch');
    });
    assert.equal(r.status, 503);
  });

  it('rejects http and credentialed upstream URLs', () => {
    process.env.CONTROL704_PROXY_Y_URL = 'http://internal.example';
    assert.equal(C.targets.loadTarget('y').configured, false);
    process.env.CONTROL704_PROXY_Y_URL = 'https://u:p@internal.example';
    assert.equal(C.targets.loadTarget('y').configured, false);
  });

  it('path validation blocks traversal and host escape', () => {
    assert.equal(C.proxy.buildSafePath(['..', 'etc']), null);
    assert.equal(C.proxy.buildSafePath(['a%2f..']), null);
    assert.equal(C.proxy.buildSafePath(['a/b']), null);
    assert.equal(C.proxy.buildSafePath(['']), null);
    assert.equal(C.proxy.buildSafePath(['v1', 'status']), '/v1/status');
    process.env.CONTROL704_PROXY_X_URL = 'https://x.example/base';
    const t = C.targets.loadTarget('x');
    assert.equal(C.proxy.resolveUpstream(t, '/v1', '?a=1').toString(), 'https://x.example/base/v1?a=1');
    assert.equal(C.proxy.resolveUpstream(t, '/v1', '?a=1#frag'), null);
    assert.equal(C.proxy.resolveUpstream(t, '@evil.com/v1'), null);
  });

  it('per-role method + path policy, credential injection, header hygiene', async () => {
    process.env.CONTROL704_PROXY_Z_URL = 'https://lattice.example';
    process.env.CONTROL704_PROXY_Z_TOKEN = 'upstream-secret-token';
    process.env.CONTROL704_PROXY_Z_POLICY = JSON.stringify({ viewer: { methods: ['GET'], paths: ['/status'] } });
    const calls = [];
    const fetchMock = async (url, init) => {
      calls.push({ url, init });
      return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': 'up=1' } });
    };
    const viewer = { sub: 'view1', role: 'viewer' };
    assert.equal((await C.proxy.proxyRequest({ target: 'z', method: 'POST', segments: ['status'], actor: viewer }, fetchMock)).status, 403);
    assert.equal((await C.proxy.proxyRequest({ target: 'z', method: 'GET', segments: ['admin'], actor: viewer }, fetchMock)).status, 403);
    assert.equal(calls.length, 0);

    const r = await C.proxy.proxyRequest(
      {
        target: 'z',
        method: 'GET',
        segments: ['status', 'now'],
        headers: { authorization: 'Bearer caller-token', cookie: 'c704_session=abc', accept: 'application/json' },
        actor: viewer
      },
      fetchMock
    );
    assert.equal(r.status, 200);
    assert.equal(calls[0].url, 'https://lattice.example/status/now');
    assert.equal(calls[0].init.headers.authorization, 'Bearer upstream-secret-token');
    assert.equal(calls[0].init.headers.cookie, undefined);
    assert.equal(calls[0].init.redirect, 'manual');
    assert.equal(r.headers['set-cookie'], undefined);

    const tech = { sub: 'tech1', role: 'technician' };
    assert.equal((await C.proxy.proxyRequest({ target: 'z', method: 'POST', segments: ['jobs'], body: '{}', actor: tech }, fetchMock)).status, 200);
    assert.equal((await C.proxy.proxyRequest({ target: 'z', method: 'DELETE', segments: ['jobs'], actor: tech }, fetchMock)).status, 403);
    assert.equal((await C.proxy.proxyRequest({ target: 'z', method: 'DELETE', segments: ['jobs'], actor: { sub: 'jean', role: 'admin' } }, fetchMock)).status, 200);
  });

  it('blocks redirects, oversize bodies, and rate-limits', async () => {
    process.env.CONTROL704_PROXY_X_URL = 'https://x.example';
    process.env.CONTROL704_PROXY_RATE_PER_MIN = '3';
    const admin = { sub: 'jean', role: 'admin' };
    const redirect = async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } });
    const r1 = await C.proxy.proxyRequest({ target: 'x', method: 'GET', segments: [], actor: admin }, redirect);
    assert.equal(r1.status, 502);
    assert.equal(r1.headers.location, undefined);

    const big = await C.proxy.proxyRequest(
      { target: 'x', method: 'POST', segments: ['u'], body: 'a'.repeat(C.proxy.MAX_REQUEST_BYTES + 1), actor: admin },
      async () => new Response('ok')
    );
    assert.equal(big.status, 413);

    const huge = await C.proxy.proxyRequest(
      { target: 'x', method: 'GET', segments: ['u'], actor: { sub: 'other', role: 'admin' } },
      async () => new Response('a'.repeat(C.proxy.MAX_RESPONSE_BYTES + 10))
    );
    assert.equal(huge.status, 502);

    const ok = async () => new Response('ok');
    const actor = { sub: 'rl', role: 'admin' };
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await C.proxy.proxyRequest({ target: 'x', method: 'GET', segments: [], actor }, ok)).status);
    assert.deepEqual(statuses, [200, 200, 200, 429]);
    delete process.env.CONTROL704_PROXY_RATE_PER_MIN;
  });
});

describe('control704 dataset override + audit', () => {
  const admin = { sub: 'jean', role: 'admin' };
  const base = { dataset: 'x', key: 'code', value: 'ABC123', reason: 'incident 42 break-glass' };

  it('denies non-admins and audits the denial', () => {
    const before = C.audit.listAudit(200).length;
    const r = C.override.submitOverride({ ...base, dryRun: false, confirm: true }, { sub: 'tech1', role: 'technician' });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
    const top = C.audit.listAudit(1)[0];
    assert.equal(top.action, 'override.denied');
    assert.equal(top.outcome, 'denied');
    assert.equal(top.actor, 'tech1');
    assert.ok(C.audit.listAudit(200).length > before);
  });

  it('requires reason, valid key, known dataset', () => {
    assert.equal(C.override.submitOverride({ ...base, reason: 'short' }, admin).error, 'reason_required');
    assert.equal(C.override.submitOverride({ ...base, key: '__proto__.x' }, admin).error, 'invalid_key');
    assert.equal(C.override.submitOverride({ ...base, dataset: 'nope' }, admin).error, 'unknown_dataset');
    assert.equal(C.override.submitOverride({ ...base, expiresAt: '2000-01-01T00:00:00Z' }, admin).error, 'invalid_expiry');
  });

  it('dry run previews diff without mutating', () => {
    const r = C.override.submitOverride(base, admin);
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'dry_run');
    assert.equal(r.diff.before, undefined);
    assert.equal(r.diff.after, 'ABC123');
    assert.deepEqual(C.override.effectiveDataset('x'), {});
    assert.equal(C.audit.listAudit(1)[0].outcome, 'preview');
  });

  it('apply requires confirm, then audits who/when/what/reason', () => {
    const noConfirm = C.override.submitOverride({ ...base, dryRun: false }, admin);
    assert.equal(noConfirm.error, 'confirm_required');
    const r = C.override.submitOverride({ ...base, dryRun: false, confirm: true, ttlMinutes: 60 }, admin);
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'applied');
    assert.deepEqual(C.override.effectiveDataset('x'), { code: 'ABC123' });
    const e = C.audit.listAudit(1)[0];
    assert.equal(e.action, 'override.apply');
    assert.equal(e.actor, 'jean');
    assert.equal(e.reason, base.reason);
    assert.equal(e.target, 'x:code');
    assert.ok(e.ts);
    assert.equal(e.detail.after, 'ABC123');
    // expiry: not active 2h later
    assert.deepEqual(C.override.effectiveDataset('x', Date.now() + 2 * 3600_000), {});
    // revert
    const rv = C.override.revertOverride(r.record.id, 'incident resolved, restore', admin);
    assert.equal(rv.ok, true);
    assert.deepEqual(C.override.effectiveDataset('x'), {});
  });

  it('audit chain is append-only and tamper-evident', () => {
    assert.equal(C.audit.verifyAuditChain().ok, true);
    const file = process.env.CONTROL704_AUDIT_PATH;
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    assert.ok(lines.length >= 5);
    const tampered = JSON.parse(lines[1]);
    tampered.actor = 'someone-else';
    lines[1] = JSON.stringify(tampered);
    writeFileSync(file, lines.join('\n') + '\n');
    C.audit._resetAuditCache();
    assert.equal(C.audit.verifyAuditChain().ok, false);
  });

  it('audit never records raw access keys', () => {
    const text = readFileSync(process.env.CONTROL704_AUDIT_PATH, 'utf8');
    assert.ok(!text.includes(adminKey));
    assert.ok(!text.includes(techKey));
  });
});

describe('control704 wiring contracts', () => {
  it('middleware protects pages + APIs and keeps login public', () => {
    const src = readFileSync(join(root, 'middleware.ts'), 'utf8');
    for (const m of ["'/control704/:path*'", "'/api/control704/:path*'", "'/api/proxy/:path*'"]) assert.ok(src.includes(m), m);
    assert.match(src, /deny\(401, 'unauthenticated'\)/);
    assert.match(src, /cross_origin_blocked/);
    assert.ok(!src.includes("'/api/chat"), 'chat must stay public');
  });

  it('proxy route re-verifies the session', () => {
    const src = readFileSync(join(root, 'app/api/proxy/[target]/[[...path]]/route.ts'), 'utf8');
    assert.match(src, /getCaller\(req\)/);
    assert.match(src, /401/);
  });

  it('agent tools are session-gated and override needs admin + confirm', () => {
    const tools = readFileSync(join(root, 'lib/control704/agent-tools.ts'), 'utf8');
    assert.match(tools, /if \(!caller\) return \[\]/);
    assert.match(tools, /caller\.role !== 'admin'/);
    assert.match(tools, /confirm: confirm === true/);
    for (const n of ['proxy_${id}', 'dataset_override', 'control704_targets']) assert.ok(tools.includes(n), n);
    const lg = readFileSync(join(root, 'lib/langgraph-tools.ts'), 'utf8');
    assert.match(lg, /buildControl704Tools\(caller, onActivity\)/);
    const chat = readFileSync(join(root, 'app/api/chat/route.ts'), 'utf8');
    assert.match(chat, /sessionFromCookieHeader/);
  });
});
