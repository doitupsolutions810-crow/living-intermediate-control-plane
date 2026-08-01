import path from 'node:path';

const root = process.env.CONTROL12_PLATFORM_ROOT || path.resolve('.control12-platform');

export const config = Object.freeze({
  version: '1.0.0',
  host: process.env.CONTROL12_PLATFORM_HOST || '127.0.0.1',
  port: Number(process.env.CONTROL12_PLATFORM_PORT || 4400),
  root,
  stateDir: path.join(root, 'state'),
  artifactDir: path.join(root, 'artifacts'),
  attestationDir: path.join(root, 'attestations'),
  auditFile: path.join(root, 'audit.jsonl'),
  accessLog: path.join(root, 'access.jsonl'),
  apiToken: process.env.CONTROL12_PLATFORM_TOKEN || '',
  maxBodyBytes: Number(process.env.CONTROL12_MAX_BODY_BYTES || 1_000_000),
  chatOpen: process.env.CONTROL12_CHAT_OPEN === '1',
  requireQuorum: process.env.CONTROL12_CODE_REQUIRE_QUORUM === '1',
  mtls: process.env.CONTROL12_MTLS === '1',
  workspace: process.env.CONTROL12_CODE_WORKSPACE || path.join(root, 'workspace')
});

export default config;
