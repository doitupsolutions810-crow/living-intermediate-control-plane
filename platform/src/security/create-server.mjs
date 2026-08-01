import http from 'node:http';
import https from 'node:https';
import { loadTlsOptions } from './tls-material.mjs';

export function createAppServer(handler) {
  const mtls = process.env.CONTROL12_MTLS === '1';
  const wantsTls = mtls || Boolean(process.env.CONTROL12_TLS_CERT);
  if (!wantsTls) {
    return {
      server: http.createServer(handler),
      mode: 'http',
      mtls: false,
      dualCa: false,
      setSecureContextFromDisk: async () => ({ ok: false, reason: 'http-mode' })
    };
  }
  let material = loadTlsOptions({ mtls });
  const server = https.createServer(material.opts, handler);
  async function setSecureContextFromDisk() {
    material = loadTlsOptions({ mtls });
    server.setSecureContext(material.opts);
    return {
      ok: true,
      dualCa: material.dualCa,
      loadedAt: material.loadedAt
    };
  }
  return {
    server,
    mode: mtls ? 'https-mtls' : 'https',
    mtls,
    dualCa: material.dualCa,
    setSecureContextFromDisk
  };
}

export function installTlsReloadSignal(handle) {
  if (!handle?.setSecureContextFromDisk) return;
  process.on('SIGHUP', () => {
    handle
      .setSecureContextFromDisk()
      .then(r => console.log('[tls] SIGHUP', r))
      .catch(e => console.error('[tls] SIGHUP failed', e.message));
  });
}
