import { tension, integrateBeliefStep, spectralTilt } from '../src/audio/jacobian.mjs';
import { LivingIntermediate } from '../src/audio/living-intermediate.mjs';
import { buildFederationDigest } from '../src/federation/digest.mjs';
import { canPublishDigest } from '../src/federation/policy-sync.mjs';
import { ExecutionPolicy } from '../src/policy/execution-policy.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';

assert.equal(Number(tension(0.5).toFixed(4)), 0.25);
assert.equal(Number(tension(0.55).toFixed(4)), 0.2475);
const b = integrateBeliefStep(0.5, { coupling: 0.1, scale: 1 });
assert.ok(b >= 0 && b <= 1);
assert.ok(spectralTilt(0.55, 1) > spectralTilt(0.55, 8));

const organ = new LivingIntermediate({ partials: 4 });
const frame = organ.tick(0.6, 0.4);
assert.equal(frame.partials.length, 4);
assert.ok(organ.toPromptFragment().includes('belief='));

const d = buildFederationDigest({ belief: 0.55, tension: 0.25, partialCount: 4 });
assert.ok(d.digest && d.digest.length === 64);
assert.equal(canPublishDigest('ok'), true);
assert.equal(canPublishDigest('high'), false);
assert.equal(canPublishDigest('high', { allowHigh: true }), true);

const dir = path.join(os.tmpdir(), 'c12-policy-test');
const pol = new ExecutionPolicy({ workspaceRoot: dir });
assert.throws(() => pol.assertCommand('sudo rm -rf /'), /blocked/);
assert.throws(() => pol.resolvePath('../etc/passwd'), /escapes/);

console.log('PASS: platform unit tests');
