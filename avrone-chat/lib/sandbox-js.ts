import vm from 'node:vm';
import { scrubSecrets } from './scrub';

export type JsSandboxResult = {
  ok: boolean;
  result?: unknown;
  stdout: string;
  error?: string;
  timedOut?: boolean;
};

const DEFAULT_TIMEOUT_MS = 3_000;
const MAX_CODE_LEN = 8_000;
const MAX_STDOUT = 24_000;

/**
 * Run a short JS snippet in node:vm with a timeout.
 * No require/process/fs — compute/analysis only.
 */
export async function runSandboxedJs(
  code: string,
  opts?: { timeoutMs?: number }
): Promise<JsSandboxResult> {
  const src = String(code || '').trim();
  if (!src) {
    return { ok: false, stdout: '', error: 'empty_code' };
  }
  if (src.length > MAX_CODE_LEN) {
    return { ok: false, stdout: '', error: 'code_too_long' };
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const logs: string[] = [];

  const consoleProxy = {
    log: (...args: unknown[]) => {
      logs.push(args.map(a => formatArg(a)).join(' '));
    },
    warn: (...args: unknown[]) => {
      logs.push('[warn] ' + args.map(a => formatArg(a)).join(' '));
    },
    error: (...args: unknown[]) => {
      logs.push('[error] ' + args.map(a => formatArg(a)).join(' '));
    },
    info: (...args: unknown[]) => {
      logs.push(args.map(a => formatArg(a)).join(' '));
    }
  };

  const sandbox: Record<string, unknown> = {
    console: consoleProxy,
    Math,
    JSON,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    Buffer: undefined,
    process: undefined,
    require: undefined,
    global: undefined,
    globalThis: undefined
  };

  const context = vm.createContext(sandbox, { name: 'avrone-js-sandbox' });

  // Wrap so expression results and statements both work.
  const wrapped =
    `(async () => {\n"use strict";\n${src}\n})()`;

  try {
    const script = new vm.Script(wrapped, { filename: 'sandbox.js' });
    const maybePromise = script.runInContext(context, {
      timeout: timeoutMs,
      displayErrors: true,
      breakOnSigint: true
    });

    const value = await Promise.race([
      Promise.resolve(maybePromise),
      new Promise((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('timeout'), { timedOut: true })), timeoutMs + 50)
      )
    ]);

    const stdout = scrubSecrets(logs.join('\n').slice(0, MAX_STDOUT));
    let result: unknown = value;
    try {
      result = JSON.parse(JSON.stringify(value));
    } catch {
      result = scrubSecrets(String(value));
    }

    return { ok: true, result, stdout };
  } catch (err) {
    const timedOut = Boolean((err as { timedOut?: boolean })?.timedOut) ||
      (err instanceof Error && /Script execution timed out/i.test(err.message));
    return {
      ok: false,
      stdout: scrubSecrets(logs.join('\n').slice(0, MAX_STDOUT)),
      error: scrubSecrets(err instanceof Error ? err.message : String(err)),
      timedOut
    };
  }
}

function formatArg(a: unknown): string {
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}
