/**
 * Shared runtime loader for authorization-grade supply-chain evidence.
 * All procurement entry points use the same report, revision, and Cosign checks.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluateSupplyChainEvidence } from './supply-chain-evidence.mjs';

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function currentRevision({ root = DEFAULT_ROOT, env = process.env } = {}) {
  // Prefer the checked-out source revision over an environment override.
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();

  // Packaged environments without Git may use the CI-provided revision.
  return (env.GITHUB_SHA || '').trim();
}

export function readSupplyChainReport({ root = DEFAULT_ROOT } = {}) {
  const reportPath = join(root, 'data', 'supply-chain-last.json');
  if (!existsSync(reportPath)) return null;
  try {
    return JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {
    return null;
  }
}

export function verifySupplyChainReportAttestation({ root = DEFAULT_ROOT, env = process.env } = {}) {
  const reportPath = join(root, 'data', 'supply-chain-last.json');
  const bundlePath = join(root, 'data', 'supply-chain-last.bundle.json');
  const identity = (env.SUPPLY_CHAIN_ATTESTATION_IDENTITY || '').trim();
  const issuer = (env.SUPPLY_CHAIN_ATTESTATION_ISSUER || '').trim();
  if (!existsSync(reportPath) || !existsSync(bundlePath) || !identity || !issuer) return false;

  const verification = spawnSync('cosign', [
    'verify-blob',
    '--bundle', bundlePath,
    '--certificate-identity', identity,
    '--certificate-oidc-issuer', issuer,
    reportPath
  ], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'ignore',
    env
  });
  return verification.status === 0;
}

export function loadSupplyChainEvidence({ root = DEFAULT_ROOT, env = process.env, nowMs, maxAgeMs } = {}) {
  const report = readSupplyChainReport({ root });
  const revision = currentRevision({ root, env });
  const reportAttestationVerified = verifySupplyChainReportAttestation({ root, env });
  const evidence = evaluateSupplyChainEvidence({
    report,
    revision,
    attestationVerified: reportAttestationVerified,
    nowMs,
    maxAgeMs
  });
  return { ...evidence, revision, reportAttestationVerified };
}
