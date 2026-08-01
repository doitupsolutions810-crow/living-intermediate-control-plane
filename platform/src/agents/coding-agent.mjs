import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ExecutionPolicy } from '../policy/execution-policy.mjs';

const execFileAsync = promisify(execFile);

export class CodingAgent {
  constructor({ workspaceRoot, policyOptions = {}, bus = null } = {}) {
    this.policy = new ExecutionPolicy({ workspaceRoot, ...policyOptions });
    this.bus = bus;
  }

  getPolicySnapshot() {
    return this.policy.snapshot();
  }

  async writeFile(rel, content) {
    const target = this.policy.resolvePath(rel);
    const bytes = this.policy.assertWriteSize(content);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, String(content ?? ''), 'utf8');
    return { path: rel, bytes, at: new Date().toISOString() };
  }

  async editFile(rel, oldString, newString, { replaceAll = false } = {}) {
    const target = this.policy.resolvePath(rel);
    let text = await fs.readFile(target, 'utf8');
    if (!text.includes(oldString)) {
      throw Object.assign(new Error('oldString not found'), { statusCode: 400 });
    }
    text = replaceAll ? text.split(oldString).join(newString) : text.replace(oldString, newString);
    this.policy.assertWriteSize(text);
    await fs.writeFile(target, text, 'utf8');
    return { path: rel, at: new Date().toISOString() };
  }

  async readFile(rel) {
    const target = this.policy.resolvePath(rel);
    const content = await fs.readFile(target, 'utf8');
    return { path: rel, content };
  }

  async listFiles(rel = '.') {
    const target = this.policy.resolvePath(rel);
    const entries = await fs.readdir(target, { withFileTypes: true });
    return {
      path: rel,
      entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }))
    };
  }

  async execute(command, { cwd = null, timeoutMs = 30_000 } = {}) {
    this.policy.assertCommand(command);
    const work = cwd ? this.policy.resolvePath(cwd) : this.policy.workspaceRoot;
    return this.policy.withConcurrency(async () => {
      try {
        const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
          cwd: work,
          timeout: timeoutMs,
          maxBuffer: 2_000_000
        });
        return { code: 0, stdout, stderr };
      } catch (err) {
        return {
          code: err.code ?? 1,
          stdout: err.stdout?.toString?.() || '',
          stderr: err.stderr?.toString?.() || err.message
        };
      }
    });
  }

  async produceAndRun({ path: rel, content, command = null }) {
    const written = await this.writeFile(rel, content);
    let execution = null;
    if (command) execution = await this.execute(command);
    return { written, execution };
  }
}

export default CodingAgent;
