import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

async function runSandboxedJs(code, timeoutMs = 1000) {
  const logs = [];
  const sandbox = {
    console: { log: (...a) => logs.push(a.join(' ')) },
    Math, JSON, Date, Number, String, Array, Object
  };
  const context = vm.createContext(sandbox);
  const wrapped = `(async () => {\n"use strict";\n${code}\n})()`;
  try {
    const script = new vm.Script(wrapped);
    const value = await script.runInContext(context, { timeout: timeoutMs });
    return { ok: true, result: value, stdout: logs.join('\n') };
  } catch (err) {
    return { ok: false, error: err.message, stdout: logs.join('\n') };
  }
}

describe('sandbox js', () => {
  it('evaluates expressions', async () => {
    const r = await runSandboxedJs('return 2 + 2');
    assert.equal(r.ok, true);
    assert.equal(r.result, 4);
  });

  it('captures console.log', async () => {
    const r = await runSandboxedJs('console.log("hi"); return 1');
    assert.equal(r.ok, true);
    assert.match(r.stdout, /hi/);
  });

  it('does not expose require', async () => {
    const r = await runSandboxedJs('return typeof require');
    assert.equal(r.ok, true);
    assert.equal(r.result, 'undefined');
  });
});
