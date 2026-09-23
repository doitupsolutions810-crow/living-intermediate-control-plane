import { runSandboxedShell } from './sandbox-shell';
import { runSandboxedJs } from './sandbox-js';
import { webFetch, webSearch } from './research';
import { scrubSecrets } from './scrub';

export type ToolActivity = {
  name: string;
  ok: boolean;
  summary: string;
  ms?: number;
};

/** OpenAI-compatible tool definitions for Chat Completions. */
export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description:
        'Search the public web (Tavily). Use for current facts, docs, and discovery. Requires TAVILY_API_KEY.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          max_results: { type: 'integer', description: '1-8 results', default: 5 }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'HTTP GET a public URL and extract readable text (size-limited).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'https URL to fetch' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'sandbox_js',
      description:
        'Run a short JavaScript snippet in an isolated vm for compute/analysis. No filesystem, network, or require.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JS source to evaluate' }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'sandbox_shell',
      description:
        'Run an allowlisted shell command in a sandbox directory. Disabled on Vercel unless AVRONE_SHELL_ENABLED=1. Prefer sandbox_js for compute.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command (allowlisted)' }
        },
        required: ['command']
      }
    }
  }
];

function parseArgs(raw: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function executeTool(
  name: string,
  argsRaw: string | Record<string, unknown> | undefined
): Promise<{ content: string; activity: ToolActivity }> {
  const started = Date.now();
  const args = parseArgs(argsRaw);
  let content = '';
  let ok = false;
  let summary = name;

  try {
    switch (name) {
      case 'web_search': {
        const query = String(args.query || '');
        const max_results = Number(args.max_results || 5);
        const r = await webSearch(query, { maxResults: max_results });
        ok = r.ok;
        summary = r.ok ? `searched “${query.slice(0, 60)}”` : `search failed`;
        content = JSON.stringify(r);
        break;
      }
      case 'web_fetch': {
        const url = String(args.url || '');
        const r = await webFetch(url);
        ok = r.ok;
        summary = r.ok ? `fetched ${new URL(url).hostname}` : `fetch failed`;
        content = JSON.stringify(r);
        break;
      }
      case 'sandbox_js': {
        const code = String(args.code || '');
        const r = await runSandboxedJs(code);
        ok = r.ok;
        summary = r.ok ? 'ran sandbox js' : r.timedOut ? 'js timeout' : 'js error';
        content = JSON.stringify(r);
        break;
      }
      case 'sandbox_shell': {
        const command = String(args.command || '');
        const r = await runSandboxedShell(command);
        ok = r.ok;
        if (r.fallback) summary = 'shell unavailable (use js)';
        else if (r.denied) summary = 'shell denied';
        else summary = r.ok ? 'ran sandbox shell' : 'shell error';
        content = JSON.stringify(r);
        break;
      }
      default:
        content = JSON.stringify({ ok: false, error: `unknown_tool:${name}` });
        summary = `unknown tool ${name}`;
        ok = false;
    }
  } catch (err) {
    content = JSON.stringify({
      ok: false,
      error: scrubSecrets(err instanceof Error ? err.message : String(err))
    });
    summary = `${name} threw`;
    ok = false;
  }

  return {
    content: scrubSecrets(content),
    activity: { name, ok, summary, ms: Date.now() - started }
  };
}

/**
 * Deterministic tool path when no LLM key is present.
 * Detects explicit research / shell / js intents and runs tools directly.
 */
export async function tryDeterministicTools(userText: string): Promise<{
  handled: boolean;
  reply?: string;
  activities: ToolActivity[];
} | null> {
  const text = String(userText || '').trim();
  if (!text) return null;
  const activities: ToolActivity[] = [];

  // Explicit prefixes / patterns
  const fetchMatch = text.match(/^(?:fetch|web_fetch|get)\s+(https?:\/\/\S+)/i);
  if (fetchMatch) {
    const { content, activity } = await executeTool('web_fetch', { url: fetchMatch[1] });
    activities.push(activity);
    return {
      handled: true,
      activities,
      reply: formatDeterministic('web_fetch', content)
    };
  }

  const searchMatch = text.match(/^(?:search|web_search|research)\s+(.+)/i);
  if (searchMatch) {
    const { content, activity } = await executeTool('web_search', { query: searchMatch[1].trim() });
    activities.push(activity);
    return {
      handled: true,
      activities,
      reply: formatDeterministic('web_search', content)
    };
  }

  const jsMatch = text.match(/^(?:js|sandbox_js|compute)\s*[:\n]\s*([\s\S]+)/i);
  if (jsMatch) {
    const { content, activity } = await executeTool('sandbox_js', { code: jsMatch[1].trim() });
    activities.push(activity);
    return {
      handled: true,
      activities,
      reply: formatDeterministic('sandbox_js', content)
    };
  }

  const shellMatch = text.match(/^(?:shell|sandbox_shell|run)\s*[:\n]\s*(.+)/i);
  if (shellMatch) {
    const { content, activity } = await executeTool('sandbox_shell', { command: shellMatch[1].trim() });
    activities.push(activity);
    return {
      handled: true,
      activities,
      reply: formatDeterministic('sandbox_shell', content)
    };
  }

  return null;
}

function formatDeterministic(tool: string, jsonContent: string): string {
  try {
    const data = JSON.parse(jsonContent);
    return `(Avrone tools · ${tool})\n\`\`\`json\n${JSON.stringify(data, null, 2).slice(0, 6000)}\n\`\`\``;
  } catch {
    return `(Avrone tools · ${tool})\n${jsonContent.slice(0, 6000)}`;
  }
}
