// Avrone Due'Krey -> Control704 proxy token contract (lib/control704/avrone-jwt.ts) and
// the opt-in CONTROL704_PROXY_<T>_TOKEN_MODE=avrone-jwt wiring in lib/control704/proxy.ts.
// The reference verifier below mirrors control704-proxy-system's rules using node:crypto.
// Set CONTROL704_PROXY_SYSTEM_DIR to a control704-proxy-system checkout to also verify
// against the real proxy verifier.
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

function load() {
  const dir = mkdtempSync(join(tmpdir(), 'c704jwt-'));
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
  return { jwt: require(join(dir, 'avrone-jwt.cjs')), proxy: require(join(dir, 'proxy.cjs')), targets: require(join(dir, 'targets.cjs')) };
}

const ISS = 'https://avrone-due-krey.test';
const AUD = 'control704-proxy';
const SECRET = 'contract-test-secret-0123456789-abcdefXYZ';
const CFG = { issuer: ISS, audience: AUD, secret: SECRET, ttlS: 120 };

/** Independent verifier: same accept/reject rules as control704-proxy-system (HS256). */
function refVerify(token, { secret = SECRET, nowS = Math.floor(Date.now() / 1000), skew = 30 } = {}) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('segments');
  for (const p of parts) if (Buffer.from(p, 'base64url').toString('base64url') !== p) throw new Error('non-canonical');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'HS256' || 'crit' in header) throw new Error('alg');
  const mac = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const sig = Buffer.from(parts[2], 'base64url');
  if (mac.length !== sig.length || !crypto.timingSafeEqual(mac, sig)) throw new Error('signature');
  if (!(typeof claims.exp === 'number' && nowS - skew < claims.exp)) throw new Error('expired');
  if (typeof claims.iat === 'number' && claims.iat > nowS + skew) throw new Error('future iat');
  if (claims.iss !== ISS) throw new Error('iss');
  if (![].concat(claims.aud).includes(AUD)) throw new Error('aud');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 256) throw new Error('sub');
  return claims;
}

let M;
before(() => {
  const tmp = mkdtempSync(join(tmpdir(), 'c704jwt-state-'));
  process.env.CONTROL704_AUDIT_PATH = join(tmp, 'audit.jsonl');
  M = load();
});

describe('avrone-jwt: config (fail closed)', () => {
  const base = { AVRONE_ISSUER: ISS, AVRONE_AUDIENCE: AUD, AVRONE_JWT_SECRET: SECRET };
  it('accepts a complete contract and defaults ttl to 120 s', () => {
    assert.deepEqual(M.jwt.proxyJwtConfig(base), { issuer: ISS, audience: AUD, secret: SECRET, ttlS: 120 });
  });
  it('returns null when any piece is missing', () => {
    for (const k of Object.keys(base)) assert.equal(M.jwt.proxyJwtConfig({ ...base, [k]: '' }), null, k);
    assert.equal(M.jwt.proxyJwtConfig({}), null);
  });
  it('rejects weak secrets with the same rules as the proxy', () => {
    for (const s of ['short', ' '.repeat(40), 'a'.repeat(40), ` ${SECRET}`, `${SECRET}\n`, 'abababababababababababababababababab']) {
      assert.equal(M.jwt.proxyJwtConfig({ ...base, AVRONE_JWT_SECRET: s }), null, JSON.stringify(s));
    }
  });
  it('clamps ttl to 30..300 s and ignores junk', () => {
    const ttl = (v) => M.jwt.proxyJwtConfig({ ...base, CONTROL704_PROXY_JWT_TTL_S: v }).ttlS;
    assert.equal(ttl('30'), 30); assert.equal(ttl('300'), 300);
    for (const v of ['29', '301', '3600', 'abc', '1.5', '-1', '']) assert.equal(ttl(v), 120, v);
  });
  it('secretProblem never echoes the secret', () => {
    const msg = M.jwt.secretProblem('tiny-secret');
    assert.ok(msg && !msg.includes('tiny-secret'));
  });
});

describe('avrone-jwt: minted tokens satisfy the Control704 contract', () => {
  it('produces HS256 tokens the reference verifier accepts, one role per technician', async () => {
    for (const role of ['viewer', 'technician', 'admin']) {
      const { token, claims } = await M.jwt.mintProxyToken('tech1', role, { config: CFG });
      const v = refVerify(token);
      assert.deepEqual(v, claims);
      assert.equal(v.iss, ISS); assert.equal(v.aud, AUD); assert.equal(v.sub, 'tech1');
      assert.deepEqual(v.roles, [role]);
      assert.equal(v.exp - v.iat, 120);
      assert.match(v.jti, /^[A-Za-z0-9_-]{16}$/);
    }
  });
  it('header is exactly {"alg":"HS256","typ":"JWT"} and encodings are canonical base64url', async () => {
    const { token } = await M.jwt.mintProxyToken('jean', 'admin', { config: CFG });
    const [h] = token.split('.');
    assert.equal(Buffer.from(h, 'base64url').toString(), '{"alg":"HS256","typ":"JWT"}');
    assert.doesNotMatch(token, /[=+/]/);
  });
  it('a different secret, a tampered payload or an expired clock all fail verification', async () => {
    const now = Date.parse('2026-11-10T12:00:00Z');
    const { token } = await M.jwt.mintProxyToken('jean', 'admin', { config: CFG, now });
    const nowS = Math.floor(now / 1000);
    assert.ok(refVerify(token, { nowS }));
    assert.throws(() => refVerify(token, { nowS, secret: SECRET + 'x' }), /signature/);
    const [h, p, s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), roles: ['admin'], sub: 'other' })).toString('base64url');
    assert.throws(() => refVerify(`${h}.${forged}.${s}`, { nowS }), /signature/);
    assert.throws(() => refVerify(token, { nowS: nowS + 120 + 30 }), /expired/);
    assert.ok(refVerify(token, { nowS: nowS + 120 + 29 }));
  });
  it('jti is unique per mint', async () => {
    const ids = new Set();
    for (let i = 0; i < 200; i++) ids.add((await M.jwt.mintProxyToken('jean', 'admin', { config: CFG })).claims.jti);
    assert.equal(ids.size, 200);
  });
  it('refuses invalid subjects and roles, and missing config', async () => {
    for (const sub of ['', 'a'.repeat(257), 'zw\u200bj', 'bidi\u202e', 'nl\nx', 'lone\ud800', 7, null]) {
      await assert.rejects(M.jwt.mintProxyToken(sub, 'admin', { config: CFG }), /subject/, JSON.stringify(sub));
    }
    for (const role of ['superuser', 'Admin', '', '__proto__']) {
      await assert.rejects(M.jwt.mintProxyToken('jean', role, { config: CFG }), /role/, role);
    }
    await assert.rejects(M.jwt.mintProxyToken('jean', 'admin', { config: null }), /not configured/);
    await assert.rejects(M.jwt.mintProxyToken('jean', 'admin', { config: { ...CFG, secret: 'weak' } }), /AVRONE_JWT_SECRET/);
  });
  it('ttl in a hand-built config is clamped to the 300 s maximum', async () => {
    const { claims } = await M.jwt.mintProxyToken('jean', 'admin', { config: { ...CFG, ttlS: 99999 } });
    assert.equal(claims.exp - claims.iat, 300);
  });
});

describe('proxy wiring: CONTROL704_PROXY_<T>_TOKEN_MODE=avrone-jwt', () => {
  const ENV_KEYS = ['CONTROL704_PROXY_X_URL', 'CONTROL704_PROXY_X_TOKEN', 'CONTROL704_PROXY_X_TOKEN_MODE', 'CONTROL704_PROXY_X_AUTH_HEADER', 'AVRONE_ISSUER', 'AVRONE_AUDIENCE', 'AVRONE_JWT_SECRET'];
  beforeEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });
  const ok = () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });

  it('mints a per-technician bearer token instead of the static credential', async () => {
    Object.assign(process.env, {
      CONTROL704_PROXY_X_URL: 'https://c704.example/proxy/x', CONTROL704_PROXY_X_TOKEN: 'static-should-not-be-sent',
      CONTROL704_PROXY_X_TOKEN_MODE: 'avrone-jwt', AVRONE_ISSUER: ISS, AVRONE_AUDIENCE: AUD, AVRONE_JWT_SECRET: SECRET
    });
    let sent;
    const r = await M.proxy.proxyRequest({ target: 'x', method: 'GET', segments: ['status'], actor: { sub: 'tech1', role: 'technician' } },
      async (url, init) => { sent = { url, headers: init.headers }; return ok(); });
    assert.equal(r.status, 200);
    const auth = sent.headers.authorization;
    assert.match(auth, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    assert.ok(!JSON.stringify(sent.headers).includes('static-should-not-be-sent'));
    const claims = refVerify(auth.slice(7));
    assert.equal(claims.sub, 'tech1'); assert.deepEqual(claims.roles, ['technician']);
  });
  it('fails closed with 503 (no upstream call) when the JWT contract is not configured', async () => {
    Object.assign(process.env, { CONTROL704_PROXY_X_URL: 'https://c704.example/proxy/x', CONTROL704_PROXY_X_TOKEN_MODE: 'avrone-jwt', CONTROL704_PROXY_X_TOKEN: 'static' });
    let called = false;
    const r = await M.proxy.proxyRequest({ target: 'x', method: 'GET', segments: [], actor: { sub: 'jean', role: 'admin' } }, async () => { called = true; return ok(); });
    assert.equal(r.status, 503);
    assert.equal(called, false);
  });
  it('static mode is unchanged (default) and an unknown mode falls back to static', async () => {
    for (const mode of [undefined, 'static', 'jwt', 'avrone', 'bearer']) {
      for (const k of ENV_KEYS) delete process.env[k];
      Object.assign(process.env, { CONTROL704_PROXY_X_URL: 'https://c704.example', CONTROL704_PROXY_X_TOKEN: 'static-tok' });
      if (mode !== undefined) process.env.CONTROL704_PROXY_X_TOKEN_MODE = mode;
      let sent;
      await M.proxy.proxyRequest({ target: 'x', method: 'GET', segments: [], actor: { sub: 'jean', role: 'admin' } }, async (u, init) => { sent = init.headers; return ok(); });
      assert.equal(sent.authorization, 'Bearer static-tok', String(mode));
    }
  });
  it('the mode name is case- and whitespace-insensitive', () => {
    process.env.CONTROL704_PROXY_X_TOKEN_MODE = ' AVRONE-JWT ';
    assert.equal(M.targets.loadTarget('x').tokenMode, 'avrone-jwt');
  });
  it('describeTarget exposes the mode but never the secret', () => {
    Object.assign(process.env, { CONTROL704_PROXY_X_URL: 'https://c704.example', CONTROL704_PROXY_X_TOKEN_MODE: 'avrone-jwt', AVRONE_JWT_SECRET: SECRET });
    const d = M.targets.describeTarget(M.targets.loadTarget('x'));
    assert.equal(d.tokenMode, 'avrone-jwt'); assert.equal(d.credentialInjected, true);
    assert.ok(!JSON.stringify(d).includes(SECRET));
  });
});

const PROXY_DIR = process.env.CONTROL704_PROXY_SYSTEM_DIR;
describe('cross-repo contract against the real control704-proxy-system verifier', { skip: !PROXY_DIR || !existsSync(join(PROXY_DIR || '.', 'src/auth/avroneProvider.js')) }, () => {
  it('every role verifies and maps to the proxy principal', async () => {
    const { createAvroneProvider } = require(join(PROXY_DIR, 'src/auth/avroneProvider.js'));
    const { toPrincipal } = require(join(PROXY_DIR, 'src/auth/index.js'));
    const provider = createAvroneProvider({ issuer: ISS, audience: AUD, secret: SECRET, clockSkewSec: 0, maxTokenAgeSec: 300 });
    for (const role of ['viewer', 'technician', 'admin']) {
      const { token } = await M.jwt.mintProxyToken('tech1', role, { config: CFG });
      const p = toPrincipal(await provider.verify(token), 'avrone-due-krey');
      assert.equal(p.sub, 'tech1'); assert.deepEqual(p.roles, [role]);
    }
  });
});
