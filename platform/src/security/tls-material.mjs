import fs from 'node:fs';
import path from 'node:path';

export function mtlsDir() {
  return process.env.CONTROL12_MTLS_DIR || path.join(process.env.HOME || '', '.control12-mtls');
}

export function resolveTlsPaths() {
  const dir = mtlsDir();
  return {
    dir,
    cert: process.env.CONTROL12_TLS_CERT || path.join(dir, 'server.pem'),
    key: process.env.CONTROL12_TLS_KEY || path.join(dir, 'server.key'),
    ca: process.env.CONTROL12_TLS_CA || path.join(dir, 'ca.pem'),
    caPrevious: process.env.CONTROL12_TLS_CA_PREVIOUS || path.join(dir, 'ca-previous.pem')
  };
}

function readIfExists(p) {
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  } catch {
    /* ignore */
  }
  return null;
}

export function loadTlsOptions({ mtls = process.env.CONTROL12_MTLS === '1' } = {}) {
  const paths = resolveTlsPaths();
  const cert = readIfExists(paths.cert);
  const key = readIfExists(paths.key);
  if (!cert || !key) throw new Error('TLS cert/key missing');
  const opts = { cert, key };
  let dualCa = false;
  if (mtls) {
    const caPrimary = readIfExists(paths.ca);
    if (!caPrimary) throw new Error('TLS CA missing');
    const cas = [caPrimary];
    const caPrev = readIfExists(paths.caPrevious);
    if (caPrev && caPrev.compare(caPrimary) !== 0) {
      cas.push(caPrev);
      dualCa = true;
    }
    opts.ca = cas;
    opts.requestCert = true;
    opts.rejectUnauthorized = true;
  }
  return { opts, paths, mtls, dualCa, loadedAt: new Date().toISOString() };
}
