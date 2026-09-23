/**
 * Operator training memory (prompt-memory, NOT weight/ML fine-tuning).
 *
 * Stores short durable lessons Jean states so they can be injected into the
 * system prompt as "Trained operator notes". Persistence is best-effort on
 * serverless (cold starts lose /tmp); prefer AVRONE_OPERATOR_MEMORY (JSON
 * array env blob) for durable production notes, or AVRONE_OPERATOR_MEMORY_PATH
 * for a writable file path.
 *
 * Export for Vercel:
 *   import { exportLessonsForEnv } from './operator-memory';
 *   // Paste the returned JSON string into Vercel env AVRONE_OPERATOR_MEMORY
 *   console.log(exportLessonsForEnv());
 *
 * Or locally after warm lessons accumulate:
 *   node -e "..."  (see README / .env.example)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { scrubSecrets } from './scrub';

export const MAX_LESSONS = 20;
export const MAX_LESSON_CHARS = 400;

const DEFAULT_TMP_PATH = '/tmp/avrone-operator-memory.json';

/**
 * High-value, non-secret operator tips distilled from docs/avrone-operator-kb.md.
 * Applied only when env blob + file + cache are all empty. Prefixed with [seed].
 * Keep ≤5.
 */
export const SEED_LESSONS: readonly string[] = [
  'Prefer OpenRouter free models when paid OpenAI/xAI credits are empty (AVRONE_LLM_PREFER=openrouter).',
  'Keep AVRONE_SHELL_ENABLED unset or 0 on Vercel; use sandbox_js for compute.',
  'Durable lessons survive Vercel cold starts via AVRONE_OPERATOR_MEMORY (JSON array env blob).',
  'Avrone chat Root Directory on Vercel is avrone-chat; leave CONTROL12_* as configured.',
  'Never store API keys or tokens as operator lessons — scrub and use Vercel secrets instead.'
];

/** In-process cache (survives warm invocations). null = not loaded yet. */
let memoryCache: string[] | null = null;

function envTrim(name: string): string {
  return (process.env[name] || '').trim();
}

function memoryPath(): string {
  return envTrim('AVRONE_OPERATOR_MEMORY_PATH') || DEFAULT_TMP_PATH;
}

function normalizeLesson(raw: string): string {
  const scrubbed = scrubSecrets(String(raw || ''));
  return scrubbed
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LESSON_CHARS);
}

function parseLessonArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const s = normalizeLesson(typeof item === 'string' ? item : String(item ?? ''));
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.slice(-MAX_LESSONS);
}

function loadFromEnvBlob(): string[] {
  const blob = envTrim('AVRONE_OPERATOR_MEMORY');
  if (!blob) return [];
  try {
    return parseLessonArray(JSON.parse(blob));
  } catch {
    return [];
  }
}

function loadFromFile(): string[] {
  try {
    const raw = readFileSync(memoryPath(), 'utf8');
    return parseLessonArray(JSON.parse(raw));
  } catch {
    return [];
  }
}

function seedLessons(): string[] {
  return parseLessonArray(SEED_LESSONS.map((s) => `[seed] ${s}`));
}

/**
 * Load lessons: in-process cache → env blob + file merge → seed defaults if empty.
 */
export function loadLessons(): string[] {
  if (memoryCache !== null) return [...memoryCache];
  const fromEnv = loadFromEnvBlob();
  const fromFile = loadFromFile();
  // Prefer merge of durable env + fresher file (env wins order for cold starts).
  let merged = parseLessonArray([...fromEnv, ...fromFile]);
  if (!merged.length) {
    merged = seedLessons();
  }
  memoryCache = merged;
  return [...merged];
}

function persistLessons(lessons: string[]): void {
  memoryCache = [...lessons];
  try {
    const path = memoryPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(lessons, null, 0), 'utf8');
  } catch {
    // Vercel /tmp or custom path may fail — in-process cache still holds for this instance.
  }
}

/**
 * Append a concise operator lesson (newest last). Returns the stored list.
 * Dedupes exact matches (moves existing to end). Scrubs secrets via scrubSecrets.
 */
export function rememberLesson(lesson: string): { ok: boolean; lessons: string[]; stored: string } {
  const stored = normalizeLesson(lesson);
  if (!stored) {
    return { ok: false, lessons: loadLessons(), stored: '' };
  }
  const current = loadLessons().filter((l) => l !== stored);
  current.push(stored);
  const next = current.slice(-MAX_LESSONS);
  persistLessons(next);
  return { ok: true, lessons: next, stored };
}

/** Format lessons for system-prompt injection. Empty string when none. */
export function formatOperatorNotes(lessons?: string[]): string {
  const list = lessons ?? loadLessons();
  if (!list.length) return '';
  const lines = list.map((l, i) => `${i + 1}. ${l}`).join('\n');
  return (
    '## Trained operator notes\n' +
    '(Prompt-memory training — not model weight fine-tuning. Prefer these when relevant.)\n' +
    lines
  );
}

/**
 * Compact JSON array string suitable to paste into Vercel env
 * `AVRONE_OPERATOR_MEMORY` (plain type, not a secret).
 */
export function exportLessonsForEnv(lessons?: string[]): string {
  const list = (lessons ?? loadLessons()).map((l) => normalizeLesson(l)).filter(Boolean);
  return JSON.stringify(list.slice(-MAX_LESSONS));
}

/**
 * Human-readable one-liner docs for operators exporting lessons.
 */
export function exportLessonsForEnvHelp(): string {
  return (
    'Set Vercel project env AVRONE_OPERATOR_MEMORY (type: plain) to the JSON array from ' +
    'exportLessonsForEnv(). Example: ["Prefer OpenRouter when paid credits are empty"]. ' +
    'Do not put API keys in this blob. Redeploy after saving.'
  );
}

/**
 * Test helper: reset in-process cache.
 * - Pass an array to set cache (empty [] = no lessons, no auto-seed until null).
 * - Pass null to clear cache so the next loadLessons() re-reads env/file/seeds.
 */
export function resetOperatorMemoryForTests(seed: string[] | null = []): void {
  memoryCache = seed === null ? null : parseLessonArray(seed);
}

/** Whether LangGraph agent path is enabled (default ON when unset/empty). */
export function isLangGraphEnabled(): boolean {
  const flag = envTrim('AVRONE_LANGGRAPH_ENABLED').toLowerCase();
  if (!flag) return true;
  return !(flag === '0' || flag === 'false' || flag === 'off' || flag === 'no');
}
