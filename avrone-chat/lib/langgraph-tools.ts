/**
 * LangChain tool() wrappers around existing Avrone executeTool / operator-memory.
 * Does not rewrite sandbox or research — delegates to current libs.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { executeTool, type ToolActivity } from './agent-tools';
import { rememberLesson } from './operator-memory';

export type ActivitySink = (a: ToolActivity) => void;

async function wrapExecute(
  name: string,
  args: Record<string, unknown>,
  onActivity?: ActivitySink
): Promise<string> {
  const { content, activity } = await executeTool(name, args);
  onActivity?.(activity);
  return content;
}

/** Build LangChain tools bound to an optional activity sink. */
export function buildLangChainTools(onActivity?: ActivitySink) {
  const web_search = tool(
    async ({ query, max_results }) =>
      wrapExecute(
        'web_search',
        { query, max_results: max_results ?? 5 },
        onActivity
      ),
    {
      name: 'web_search',
      description:
        'Search the public web (Tavily). Use for current facts, docs, and discovery. Requires TAVILY_API_KEY.',
      schema: z.object({
        query: z.string().describe('Search query'),
        max_results: z.number().int().min(1).max(8).optional().describe('1-8 results')
      })
    }
  );

  const web_fetch = tool(
    async ({ url }) => wrapExecute('web_fetch', { url }, onActivity),
    {
      name: 'web_fetch',
      description: 'HTTP GET a public URL and extract readable text (size-limited).',
      schema: z.object({
        url: z.string().describe('https URL to fetch')
      })
    }
  );

  const sandbox_js = tool(
    async ({ code }) => wrapExecute('sandbox_js', { code }, onActivity),
    {
      name: 'sandbox_js',
      description:
        'Run a short JavaScript snippet in an isolated vm for compute/analysis. No filesystem, network, or require.',
      schema: z.object({
        code: z.string().describe('JS source to evaluate')
      })
    }
  );

  const sandbox_shell = tool(
    async ({ command }) => wrapExecute('sandbox_shell', { command }, onActivity),
    {
      name: 'sandbox_shell',
      description:
        'Run an allowlisted shell command in a sandbox directory. Disabled on Vercel unless AVRONE_SHELL_ENABLED=1. Prefer sandbox_js for compute.',
      schema: z.object({
        command: z.string().describe('Shell command (allowlisted)')
      })
    }
  );

  const remember_lesson = tool(
    async ({ lesson }) => {
      const started = Date.now();
      const r = rememberLesson(lesson);
      const activity: ToolActivity = {
        name: 'remember_lesson',
        ok: r.ok,
        summary: r.ok ? 'stored operator lesson' : 'empty lesson',
        ms: Date.now() - started
      };
      onActivity?.(activity);
      return JSON.stringify({
        ok: r.ok,
        stored: r.stored,
        count: r.lessons.length,
        note: 'Prompt-memory training (not weight fine-tuning). Lesson will appear in future system prompts on this instance / when env blob is updated.'
      });
    },
    {
      name: 'remember_lesson',
      description:
        'Store a concise durable operator lesson / preference / fact Jean stated. Use for prefs that should persist across turns (prompt-memory training, not ML weight training). Keep under ~400 chars.',
      schema: z.object({
        lesson: z.string().describe('Concise durable lesson or preference')
      })
    }
  );

  return [web_search, web_fetch, sandbox_js, sandbox_shell, remember_lesson];
}
