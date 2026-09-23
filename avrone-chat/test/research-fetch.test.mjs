import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedUrl } from '../lib/sandbox-shell-rules.mjs';

/**
 * Stubbed fetch behaviour for research — unit-level without network.
 * Mirrors avrone-chat/lib/research.ts webFetch guard + html strip essentials.
 */
function htmlToText(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : undefined;
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { title, text };
}

async function webFetchStub(url, fetchImpl) {
  const blocked = isBlockedUrl(url);
  if (blocked) return { ok: false, url, text: '', error: blocked };
  const res = await fetchImpl(url);
  const raw = await res.text();
  const { title, text } = htmlToText(raw);
  return { ok: res.ok, url, status: res.status, title, text };
}

describe('research web_fetch stub', () => {
  it('returns extracted text from stubbed HTML', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '<html><head><title>Hello</title></head><body><h1>Hi</h1><p>World</p><script>evil()</script></body></html>'
    });
    const r = await webFetchStub('https://example.com/', fetchImpl);
    assert.equal(r.ok, true);
    assert.equal(r.title, 'Hello');
    assert.match(r.text, /Hi/);
    assert.match(r.text, /World/);
    assert.doesNotMatch(r.text, /evil/);
  });

  it('short-circuits blocked URLs without calling fetch', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return { ok: true, status: 200, text: async () => '' };
    };
    const r = await webFetchStub('http://169.254.169.254/', fetchImpl);
    assert.equal(r.ok, false);
    assert.equal(r.error, 'blocked_host');
    assert.equal(called, false);
  });
});
