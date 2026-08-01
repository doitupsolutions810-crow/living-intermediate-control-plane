import fs from 'node:fs/promises';
import path from 'node:path';

export class AccessLogger {
  constructor(file) {
    this.file = file;
  }

  async write(entry) {
    if (!this.file) return;
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.appendFile(
      this.file,
      JSON.stringify({ type: 'access', observedAt: new Date().toISOString(), ...entry }) + '\n'
    );
  }

  instrument(req, res, meta = {}) {
    const start = Date.now();
    const remote =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    const originalEnd = res.end.bind(res);
    res.end = (...args) => {
      const result = originalEnd(...args);
      void this.write({
        method: req.method,
        path: meta.path || req.url?.split('?')[0],
        status: res.statusCode,
        durationMs: Date.now() - start,
        remote,
        auth: meta.auth || null
      });
      return result;
    };
  }
}
