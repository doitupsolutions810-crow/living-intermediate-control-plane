/**
 * Operator training memory (prompt-memory, NOT weight/ML fine-tuning).
 *
 * Stores short durable lessons Jean states so they can be injected into the
 * system prompt as "Trained operator notes". Persistence is best-effort on
 * serverless (cold starts lose /tmp); prefer AVRONE_OPERATOR_MEMORY (JSON
 * array env blob) for durable production notes, or AVRONE_OPERATOR_MEMORY_PATH
 * for a writable file path.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const MAX_LESSONS = 20;
export const MAX_LESSON_CHARS = 400;

const DEFAULT_TMP_PATH = '/tmp/avrone-operator-memory.json';

/** In-process cache (survives warm invocations). */
let memoryCache: string[] | null = null;

function envTrim(name: string): string {
  return (process.env[name] || '').trim();
}

function memoryPath(): string {
  return envTrim('AVRONE_OPERATOR_MEMORY_PATH') || DEFAULT_TMP_PATH;
}

function normalizeLesson(raw: string): string {
  return String(raw || '')
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

/** Load lessons: in-process cache → env blob → file → empty. */
export function loadLessons(): string[] {
  if (memoryCache) return [...memoryCache];
  const fromEnv = loadFromEnvBlob();
  const fromFile = loadFromFile();
  // Prefer longer of the two sources (env is durable on Vercel; file may be fresher on a warm host).
  const merged = parseLessonArray([...fromEnv, ...fromFile]);
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
 * Dedupes exact matches (moves existing to end).
 */
export function rememberLesson(lesson: string): { ok: boolean; lessons: string[]; stored: string } {
  const stored = normalizeLesson(lesson);
  if (!stored) {
    return { ok: false, lessons: loadLessons(), stored: '' };
  }
  const current = loadLessons().filter(l => l !== stored);
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

/** Test helper: reset in-process cache (does not wipe env). */
export function resetOperatorMemoryForTests(seed: string[] = []): void {
  memoryCache = parseLessonArray(seed);
}

/** Whether LangGraph agent path is enabled (default ON when unset/empty). */
export function isLangGraphEnabled(): boolean {
  const flag = envTrim('AVRONE_LANGGRAPH_ENABLED').toLowerCase();
  if (!flag) return true;
  return !(flag === '0' || flag === 'false' || flag === 'off' || flag === 'no');
}
