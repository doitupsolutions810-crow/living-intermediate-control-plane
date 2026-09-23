import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

function loadOperatorMemory() {
  const src = readFileSync(join(root, 'lib/operator-memory.ts'), 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    fileName: 'operator-memory.ts'
  });
  const dir = mkdtempSync(join(tmpdir(), 'avrone-opmem-'));
  const out = join(dir, 'operator-memory.cjs');
  writeFileSync(out, outputText);
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

  it('rememberLesson stores, dedupes, caps at 20, formats notes', () => {
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
    for (let i = 0; i < 25; i++) mod.rememberLesson(`L${i}`);
    assert.equal(mod.loadLessons().length, 20);
  });
});
