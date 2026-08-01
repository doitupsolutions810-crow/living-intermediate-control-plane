import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { analyzeAccessLog } from './anomaly-detector.mjs';
import { resolveTlsPaths } from './tls-material.mjs';

const execFileAsync = promisify(execFile);

export async function certNeedsRenew(renewDays = 60) {
  const { cert } = resolveTlsPaths();
  try {
    await execFileAsync('openssl', [
      'x509',
      '-in',
      cert,
      '-checkend',
      String(renewDays * 86400),
      '-noout'
    ]);
    return false;
  } catch {
    return true;
  }
}

export async function runRenewRespond({ accessLog, renewDays = 60 } = {}) {
  const needs = await certNeedsRenew(renewDays);
  const anomalies = await analyzeAccessLog(accessLog);
  return {
    at: new Date().toISOString(),
    certNeedsRenew: needs,
    anomalies,
    hint: needs
      ? 'run scripts/mtls-cutover.sh'
      : anomalies.severity === 'high'
        ? 'review access log / remediate'
        : null
  };
}
