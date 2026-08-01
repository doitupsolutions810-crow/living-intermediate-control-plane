#!/usr/bin/env node
/**
 * Automated daily operator loop
 *
 * Default sequence:
 *   1. init (safe)
 *   2. checklist
 *   3. procure (ACCEPT_LOCAL_EVIDENCE=1)
 *   4. doctor
 *   5. security-scan (ALLOW_SKIP=1 unless REQUIRE_SECURITY_TOOLS=1)
 *   6. metrics
 *   7. security-summary
 *
 * Env:
 *   DAILY_GATE_DOCTOR=1     use procure with GATE_DOCTOR=1
 *   DAILY_SKIP_SECURITY=1   skip security-scan
 *   DAILY_SKIP_SIGN=1       skip optional cosign (default skip)
 *   DAILY_SIGN=1            attempt cosign sign/verify when IMAGE_REF set
 *   IMAGE_REF               image for optional sign step
 *   REQUIRE_SECURITY_TOOLS=1  security-scan must have tools
 *   DAILY_CONTINUE_ON_FAIL=1  run all steps even if one fails
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

const continueOnFail = process.env.DAILY_CONTINUE_ON_FAIL === '1';
const gateDoctor = process.env.DAILY_GATE_DOCTOR === '1';
const skipSecurity = process.env.DAILY_SKIP_SECURITY === '1';
const doSign = process.env.DAILY_SIGN === '1';
const imageRef = process.env.IMAGE_REF || '';

function runStep(name, script, extraArgs = [], env = {}) {
  process.stdout.write(`\n======== ${name} ========\n`);
  const args = [join(root, script), ...extraArgs];
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit'
  });
  return {
    name,
    ok: result.status === 0,
    status: result.status === null ? 1 : result.status
  };
}

const steps = [];

steps.push(() => runStep('init', 'status/init.mjs'));
steps.push(() => runStep('checklist', 'status/checklist.mjs'));
steps.push(() =>
  runStep(
    gateDoctor ? 'procure (gated)' : 'procure',
    'integrate.mjs',
    ['procure'],
    {
      ACCEPT_LOCAL_EVIDENCE: '1',
      ...(gateDoctor ? { GATE_DOCTOR: '1' } : {})
    }
  )
);
steps.push(() => runStep('doctor', 'status/doctor.mjs'));

if (!skipSecurity) {
  steps.push(() =>
    runStep('security-scan', 'status/security-scan.mjs', [], {
      ALLOW_SKIP: process.env.REQUIRE_SECURITY_TOOLS === '1' ? '0' : '1'
    })
  );
}

steps.push(() => runStep('metrics', 'status/metrics.mjs'));
steps.push(() => runStep('security-summary', 'status/security-summary.mjs'));

if (doSign && imageRef) {
  steps.push(() =>
    runStep('cosign-sign', 'status/cosign-sign.mjs', [], {
      IMAGE_REF: imageRef,
      ALLOW_SKIP: '1'
    })
  );
  steps.push(() =>
    runStep('cosign-verify', 'status/cosign-verify.mjs', [], {
      IMAGE_REF: imageRef,
      ALLOW_SKIP: '1'
    })
  );
}

const results = [];
let failed = 0;

for (const step of steps) {
  const r = step();
  results.push(r);
  if (!r.ok) {
    failed++;
    if (!continueOnFail) break;
  }
}

const summary = {
  timestamp: new Date().toISOString(),
  ok: failed === 0,
  failed,
  passed: results.filter(r => r.ok).length,
  results,
  options: {
    gateDoctor,
    skipSecurity,
    sign: doSign && Boolean(imageRef),
    imageRef: imageRef || null,
    continueOnFail
  },
  note: failed === 0
    ? 'Daily operator loop completed successfully.'
    : 'Daily operator loop stopped with failures (or continued with DAILY_CONTINUE_ON_FAIL=1).'
};

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
writeFileSync(join(dataDir, 'daily-loop-last.json'), JSON.stringify(summary, null, 2) + '\n');

console.log('\n' + JSON.stringify(summary, null, 2));
process.exit(failed === 0 ? 0 : 1);
