/**
 * Bounded terminal / write policy for coding agents.
 */

import path from 'node:path';

const DEFAULT_BLOCK = [
  /\brm\s+-rf\s+[\/]/i,
  /\bsudo\b/i,
  /\bcurl\b.*\|\s*(ba)?sh/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i
];

export class ExecutionPolicy {
  constructor({
    workspaceRoot,
    maxWriteBytes = 512_000,
    maxCommandChars = 2000,
    maxConcurrent = 2,
    strictAllowlist = false,
    allowlist = []
  } = {}) {
    this.workspaceRoot = path.resolve(workspaceRoot || process.cwd());
    this.maxWriteBytes = maxWriteBytes;
    this.maxCommandChars = maxCommandChars;
    this.maxConcurrent = maxConcurrent;
    this.strictAllowlist = strictAllowlist;
    this.allowlist = allowlist;
    this.active = 0;
  }

  resolvePath(rel) {
    const target = path.resolve(this.workspaceRoot, rel || '.');
    const relToRoot = path.relative(this.workspaceRoot, target);
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      throw Object.assign(new Error('path escapes workspace'), { statusCode: 400, code: 'PATH_ESCAPE' });
    }
    return target;
  }

  assertWriteSize(content) {
    const bytes = Buffer.byteLength(String(content ?? ''), 'utf8');
    if (bytes > this.maxWriteBytes) {
      throw Object.assign(new Error(`write exceeds ${this.maxWriteBytes} bytes`), {
        statusCode: 413,
        code: 'WRITE_TOO_LARGE'
      });
    }
    return bytes;
  }

  assertCommand(command) {
    const cmd = String(command || '');
    if (!cmd.trim()) {
      throw Object.assign(new Error('empty command'), { statusCode: 400 });
    }
    if (cmd.length > this.maxCommandChars) {
      throw Object.assign(new Error('command too long'), { statusCode: 400 });
    }
    for (const re of DEFAULT_BLOCK) {
      if (re.test(cmd)) {
        throw Object.assign(new Error('command blocked by policy'), {
          statusCode: 403,
          code: 'COMMAND_BLOCKED'
        });
      }
    }
    if (this.strictAllowlist) {
      const ok = this.allowlist.some(a => cmd.startsWith(a));
      if (!ok) {
        throw Object.assign(new Error('command not on allowlist'), {
          statusCode: 403,
          code: 'ALLOWLIST'
        });
      }
    }
  }

  async withConcurrency(fn) {
    if (this.active >= this.maxConcurrent) {
      throw Object.assign(new Error('too many concurrent executions'), {
        statusCode: 429,
        code: 'CONCURRENCY'
      });
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
    }
  }

  snapshot() {
    return {
      workspaceRoot: this.workspaceRoot,
      maxWriteBytes: this.maxWriteBytes,
      maxCommandChars: this.maxCommandChars,
      maxConcurrent: this.maxConcurrent,
      strictAllowlist: this.strictAllowlist,
      active: this.active
    };
  }
}

export default ExecutionPolicy;
