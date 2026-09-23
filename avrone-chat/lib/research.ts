import { scrubSecrets } from './scrub';

export type WebFetchResult = {
  ok: boolean;
  url: string;
  status?: number;
  title?: string;
  text: string;
  error?: string;
};

export type WebSearchHit = {
  title: string;
  url: string;
  content: string;
};

export type WebSearchResult = {
  ok: boolean;
  query: string;
  results: WebSearchHit[];
  error?: string;
  provider?: string;
};

const MAX_FETCH_BYTES = 200_000;
const MAX_TEXT_CHARS = 24_000;
const FETCH_TIMEOUT_MS = 12_000;

const BLOCKED_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.google',
  'kubernetes.default',
  'kubernetes.default.svc'
]);

function isBlockedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return 'invalid_url';
  }
  if (!['http:', 'https:'].includes(u.protocol)) return 'protocol_not_allowed';
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return 'blocked_host';
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === '::1'
  ) {
    return 'private_or_local_host';
  }
  return null;
}

function htmlToText(html: string): { title?: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : undefined;
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  text = decodeEntities(text);
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS) + '\n…[truncated]';
  }
  return { title, text };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export async function webFetch(url: string): Promise<WebFetchResult> {
  const blocked = isBlockedUrl(url);
  if (blocked) {
    return { ok: false, url, text: '', error: blocked };
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': 'AvroneResearchBot/1.0 (+https://avrone-due-krey-chat.vercel.app)',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5'
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    const buf = Buffer.from(await res.arrayBuffer());
    const sliced = buf.subarray(0, MAX_FETCH_BYTES);
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    const raw = sliced.toString('utf8');

    if (ctype.includes('application/json') || raw.trimStart().startsWith('{') || raw.trimStart().startsWith('[')) {
      const text = scrubSecrets(raw.slice(0, MAX_TEXT_CHARS));
      return { ok: res.ok, url: res.url || url, status: res.status, text, title: 'json' };
    }

    const { title, text } = htmlToText(raw);
    return {
      ok: res.ok,
      url: res.url || url,
      status: res.status,
      title,
      text: scrubSecrets(text)
    };
  } catch (err) {
    return {
      ok: false,
      url,
      text: '',
      error: scrubSecrets(err instanceof Error ? err.message : String(err))
    };
  }
}

export async function webSearch(query: string, opts?: { maxResults?: number }): Promise<WebSearchResult> {
  const q = String(query || '').trim();
  if (!q) return { ok: false, query: '', results: [], error: 'empty_query' };

  const key = (process.env.TAVILY_API_KEY || '').trim();
  if (!key) {
    return {
      ok: false,
      query: q,
      results: [],
      error: 'TAVILY_API_KEY unset — use web_fetch with a known URL, or set Tavily for search.',
      provider: 'none'
    };
  }

  const maxResults = Math.min(Math.max(opts?.maxResults ?? 5, 1), 8);

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: q,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false
      }),
      signal: AbortSignal.timeout(15_000)
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        query: q,
        results: [],
        error: scrubSecrets(`tavily_http_${res.status}: ${body.slice(0, 200)}`),
        provider: 'tavily'
      };
    }

    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const results: WebSearchHit[] = (data.results || []).map(r => ({
      title: scrubSecrets(String(r.title || '')),
      url: String(r.url || ''),
      content: scrubSecrets(String(r.content || '').slice(0, 1_500))
    }));

    return { ok: true, query: q, results, provider: 'tavily' };
  } catch (err) {
    return {
      ok: false,
      query: q,
      results: [],
      error: scrubSecrets(err instanceof Error ? err.message : String(err)),
      provider: 'tavily'
    };
  }
}

export const __test = { isBlockedUrl, htmlToText };
