import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

function transpile(relPath) {
  const src = readFileSync(join(root, relPath), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    fileName: relPath
  });
  return outputText;
}

function loadOperatorMemory() {
  const dir = mkdtempSync(join(tmpdir(), 'avrone-opmem-'));
  // scrub is a dependency — transpile both into the temp dir
  writeFileSync(join(dir, 'scrub.cjs'), transpile('lib/scrub.ts'));
  let memJs = transpile('lib/operator-memory.ts');
  memJs = memJs.replace(/require\(["']\.\/scrub["']\)/, 'require("./scrub.cjs")');
  const out = join(dir, 'operator-memory.cjs');
  writeFileSync(out, memJs);
  delete require.cache[require.resolve(out)];
  return { mod: require(out), dir };
}

function loadLangsmithInit() {
  const dir = mkdtempSync(join(tmpdir(), 'avrone-ls-'));
  const out = join(dir, 'langsmith-init.cjs');
  writeFileSync(out, transpile('lib/langsmith-init.ts'));
  delete require.cache[require.resolve(out)];
  return { mod: require(out), dir };
}

describe('operator-memory + LangGraph flag', () => {
  let dir;
  let mod;
  const prev = {};

  beforeEach(() => {
    for (const k of [
      'AVRONE_LANGGRAPH_ENABLED',
      'AVRONE_OPERATOR_MEMORY',
      'AVRONE_OPERATOR_MEMORY_PATH'
    ]) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    const loaded = loadOperatorMemory();
    mod = loaded.mod;
    dir = loaded.dir;
    process.env.AVRONE_OPERATOR_MEMORY_PATH = join(dir, 'lessons.json');
    mod.resetOperatorMemoryForTests([]);
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('AVRONE_LANGGRAPH_ENABLED defaults on; 0/false/off disables', () => {
    assert.equal(mod.isLangGraphEnabled(), true);
    process.env.AVRONE_LANGGRAPH_ENABLED = '';
    assert.equal(mod.isLangGraphEnabled(), true);
    process.env.AVRONE_LANGGRAPH_ENABLED = '0';
    assert.equal(mod.isLangGraphEnabled(), false);
    process.env.AVRONE_LANGGRAPH_ENABLED = 'false';
    assert.equal(mod.isLangGraphEnabled(), false);
    process.env.AVRONE_LANGGRAPH_ENABLED = 'off';
    assert.equal(mod.isLangGraphEnabled(), false);
    process.env.AVRONE_LANGGRAPH_ENABLED = '1';
    assert.equal(mod.isLangGraphEnabled(), true);
  });

  it('rememberLesson stores, dedupes, caps at 20, formats notes, writes path', () => {
    assert.equal(mod.rememberLesson('').ok, false);
    const a = mod.rememberLesson('  Prefer   OpenRouter  ');
    assert.equal(a.ok, true);
    assert.equal(a.stored, 'Prefer OpenRouter');
    mod.rememberLesson('Prefer OpenRouter'); // dedupe → still 1
    assert.equal(mod.loadLessons().length, 1);
    mod.rememberLesson('Keep answers concise');
    assert.equal(mod.loadLessons().length, 2);
    const notes = mod.formatOperatorNotes();
    assert.match(notes, /Trained operator notes/);
    assert.match(notes, /OpenRouter/);
    assert.ok(existsSync(process.env.AVRONE_OPERATOR_MEMORY_PATH));
    const onDisk = JSON.parse(readFileSync(process.env.AVRONE_OPERATOR_MEMORY_PATH, 'utf8'));
    assert.equal(onDisk.length, 2);
    for (let i = 0; i < 25; i++) mod.rememberLesson(`L${i}`);
    assert.equal(mod.loadLessons().length, 20);
  });

  it('loads AVRONE_OPERATOR_MEMORY env blob and merges with file', () => {
    process.env.AVRONE_OPERATOR_MEMORY = JSON.stringify(['From env lesson']);
    writeFileSync(
      process.env.AVRONE_OPERATOR_MEMORY_PATH,
      JSON.stringify(['From file lesson'])
    );
    mod.resetOperatorMemoryForTests(null);
    const lessons = mod.loadLessons();
    assert.ok(lessons.includes('From env lesson'));
    assert.ok(lessons.includes('From file lesson'));
  });

  it('seeds ≤5 marked lessons when memory empty', () => {
    delete process.env.AVRONE_OPERATOR_MEMORY;
    const path = process.env.AVRONE_OPERATOR_MEMORY_PATH;
    try {
      rmSync(path, { force: true });
    } catch {
      /* ignore */
    }
    mod.resetOperatorMemoryForTests(null);
    const lessons = mod.loadLessons();
    assert.ok(lessons.length >= 1 && lessons.length <= 5);
    assert.ok(lessons.every((l) => l.startsWith('[seed]')));
    assert.ok(mod.SEED_LESSONS.length <= 5);
  });

  it('exportLessonsForEnv returns pasteable JSON; scrub secrets', () => {
    mod.resetOperatorMemoryForTests([]);
    mod.rememberLesson('Prefer concise answers');
    mod.rememberLesson('api_key=sk-abcdefghijklmnopqrstuvwxyz012345');
    const blob = mod.exportLessonsForEnv();
    const parsed = JSON.parse(blob);
    assert.ok(Array.isArray(parsed));
    assert.ok(parsed.some((l) => l.includes('concise')));
    assert.ok(!blob.includes('sk-abcdefghijklmnopqrstuvwxyz012345'));
    assert.match(mod.exportLessonsForEnvHelp(), /AVRONE_OPERATOR_MEMORY/);
  });
});

describe('langsmith-init', () => {
  let dir;
  let mod;
  const keys = [
    'LANGCHAIN_TRACING_V2',
    'LANGSMITH_TRACING',
    'LANGSMITH_TRACING_V2',
    'LANGCHAIN_TRACING',
    'LANGCHAIN_API_KEY',
    'LANGSMITH_API_KEY',
    'LANGCHAIN_PROJECT',
    'LANGSMITH_PROJECT',
    'AVRONE_LANGSMITH_PROJECT'
  ];
  const prev = {};

  beforeEach(() => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    const loaded = loadLangsmithInit();
    mod = loaded.mod;
    dir = loaded.dir;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('no-op when tracing unset', () => {
    const r = mod.ensureLangSmithEnv();
    assert.equal(r.tracing, false);
    assert.equal(mod.isLangSmithTracingRequested(), false);
  });

  it('syncs LANGSMITH_* to LANGCHAIN_* when tracing on', () => {
    process.env.LANGSMITH_TRACING = 'true';
    process.env.LANGSMITH_API_KEY = 'ls-test-key-not-real';
    const r = mod.ensureLangSmithEnv();
    assert.equal(r.tracing, true);
    assert.equal(r.keyed, true);
    assert.equal(process.env.LANGCHAIN_TRACING_V2, 'true');
    assert.equal(process.env.LANGCHAIN_API_KEY, 'ls-test-key-not-real');
    assert.ok(process.env.LANGCHAIN_PROJECT);
  });

  it('tracing without key still reports keyed=false (safe no-op send)', () => {
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    const r = mod.ensureLangSmithEnv();
    assert.equal(r.tracing, true);
    assert.equal(r.keyed, false);
  });
});
