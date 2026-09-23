import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { scrubSecrets } from './scrub';

export type ShellResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut?: boolean;
  denied?: boolean;
  reason?: string;
  fallback?: boolean;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_OUTPUT_BYTES = 48_000;

/** First-token allowlist — keep narrow for serverless safety. */
const ALLOWED_COMMANDS = new Set([
  'ls',
  'pwd',
  'echo',
  'date',
  'uname',
  'wc',
  'head',
  'tail',
  'cat',
  'printf',
  'true',
  'false',
  'basename',
  'dirname',
  'whoami',
  'id',
  'env',
  'printenv',
  'node',
  'which',
  'test',
  'stat',
  'find',
  'grep',
  'rg',
  'sort',
  'uniq',
  'cut',
  'tr',
  'sed',
  'awk'
]);

const DENY_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/\b/,
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bchmod\s+777\b/,
  /\bchown\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bcurl\b.*(?:169\.254\.169\.254|metadata\.google|metadata\.azure|instance-data)/i,
  /\bwget\b.*(?:169\.254\.169\.254|metadata)/i,
  /\bnc\s+-l\b/,
  /\bncat\b/,
  /\/etc\/passwd/,
  /\/etc\/shadow/,
  />\s*\/dev\/sd/,
  /\bkill\s+-9\b/,
  /\breboot\b/,
  /\bshutdown\b/,
  /\$\(.*curl/i,
  /`.*curl/i
];

function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function shellEnabled(): boolean {
  const flag = (process.env.AVRONE_SHELL_ENABLED || '').trim();
  if (flag === '0' || flag.toLowerCase() === 'false') return false;
  if (flag === '1' || flag.toLowerCase() === 'true') return true;
  // Default: off on Vercel / serverless; on only when explicitly enabled.
  return !isVercelRuntime();
}

function sandboxRoot(): string {
  const configured = (process.env.AVRONE_SANDBOX_DIR || '').trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), '.avrone-sandbox');
}

function ensureSandboxDir(root: string): void {
  fs.mkdirSync(root, { recursive: true });
}

function parseFirstToken(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return '';
  // Support simple pipes: check first segment only for allowlist; deny patterns scan full string.
  const firstSeg = trimmed.split('|')[0].trim();
  const m = firstSeg.match(/^([a-zA-Z0-9._+-]+)/);
  return m ? m[1] : '';
}

export function validateShellCommand(command: string): { ok: true } | { ok: false; reason: string } {
  const cmd = String(command || '').trim();
  if (!cmd) return { ok: false, reason: 'empty_command' };
  if (cmd.length > 2_000) return { ok: false, reason: 'command_too_long' };

  for (const re of DENY_PATTERNS) {
    if (re.test(cmd)) return { ok: false, reason: `denied_pattern:${re.source.slice(0, 40)}` };
  }

  // Every pipeline segment's first token must be allowlisted.
  const segments = cmd.split('|').map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    // Strip simple env assignments: FOO=bar cmd
    const withoutEnv = seg.replace(/^([A-Za-z_][A-Za-z0-9_]*=\S+\s+)+/, '');
    const token = parseFirstToken(withoutEnv);
    if (!token || !ALLOWED_COMMANDS.has(token)) {
      return { ok: false, reason: `command_not_allowlisted:${token || '?'}` };
    }
  }
  return { ok: true };
}

function scrubEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH || '/usr/bin:/bin',
    HOME: sandboxRoot(),
    LANG: 'C.UTF-8',
    TERM: 'dumb',
    NODE_ENV: process.env.NODE_ENV || 'production'
  };
  // Do not pass API keys / tokens into the shell.
  return env;
}

/**
 * Run an allowlisted shell command under the sandbox directory.
 * On Vercel (or when disabled), returns a clear fallback preferring JS sandbox.
 */
export async function runSandboxedShell(
  command: string,
  opts?: { timeoutMs?: number; cwd?: string }
): Promise<ShellResult> {
  if (!shellEnabled()) {
    return {
      ok: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      fallback: true,
      reason:
        'Shell disabled on this runtime (set AVRONE_SHELL_ENABLED=1 only on trusted hosts). Prefer sandbox_js for compute.'
    };
  }

  const check = validateShellCommand(command);
  if (!check.ok) {
    return {
      ok: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      denied: true,
      reason: check.reason
    };
  }

  const root = sandboxRoot();
  ensureSandboxDir(root);
  const cwd = opts?.cwd ? path.resolve(root, opts.cwd) : root;
  if (!cwd.startsWith(root)) {
    return {
      ok: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      denied: true,
      reason: 'cwd_outside_sandbox'
    };
  }
  ensureSandboxDir(cwd);

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn('/bin/bash', ['-c', command], {
      cwd,
      env: scrubEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    const take = (buf: Buffer, which: 'out' | 'err') => {
      const chunk = buf.toString('utf8');
      if (which === 'out') {
        if (Buffer.byteLength(stdout, 'utf8') < MAX_OUTPUT_BYTES) stdout += chunk;
      } else {
        if (Buffer.byteLength(stderr, 'utf8') < MAX_OUTPUT_BYTES) stderr += chunk;
      }
    };

    child.stdout?.on('data', (b: Buffer) => take(b, 'out'));
    child.stderr?.on('data', (b: Buffer) => take(b, 'err'));

    child.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        stdout: scrubSecrets(stdout),
        stderr: scrubSecrets(stderr || err.message),
        exitCode: null,
        reason: 'spawn_error'
      });
    });

    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const out = scrubSecrets(stdout.slice(0, MAX_OUTPUT_BYTES));
      const err = scrubSecrets(stderr.slice(0, MAX_OUTPUT_BYTES));
      resolve({
        ok: !timedOut && code === 0,
        stdout: out,
        stderr: err,
        exitCode: code,
        timedOut,
        reason: timedOut ? 'timeout' : undefined
      });
    });
  });
}

export const __test = { validateShellCommand, ALLOWED_COMMANDS, DENY_PATTERNS, shellEnabled };
