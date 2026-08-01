#!/usr/bin/env node
/**
 * Connectors / toolsets / skills registry view
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAuthorized, readSession } from '../agents/llama/session.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manifestPath = join(root, 'connectors/manifest.json');

let version = 'unknown';
try {
  version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
} catch {}

const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { connectors: [], skills: [], toolsets: {} };

const localTools = {
  ollamaConfigured: existsSync(join(root, 'agents/llama/config.json')),
  agentAuthorized: isAuthorized(root),
  session: readSession(root),
  planeCli: existsSync(join(root, 'bin/plane.mjs')),
  ciWorkflow: existsSync(join(root, '.github/workflows/plane-ci.yml')),
  trivyPolicy: existsSync(join(root, 'policy/trivy-results.rego')),
  snykPolicy: existsSync(join(root, 'policy/snyk-results.rego'))
};

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  version,
  manifest,
  localTools,
  howToUse: {
    list: 'plane connectors',
    agent: 'plane agent-chat',
    unattended: 'plane unattended',
    progress: 'plane progress',
    docs: 'docs/connectors.md'
  },
  note: 'Connectors are registered for operator use. Optional cloud connectors activate when their credentials/sessions exist in the host environment.'
}, null, 2));
