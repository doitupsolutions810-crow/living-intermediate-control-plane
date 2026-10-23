import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIVATION_SCHEMA, MAX_EVIDENCE_AGE_MS, REQUIRED_CHECKS } from '../status/activation-gate.mjs';
import { GUIDE_CHECKS } from '../status/activation-guide.mjs';

const pythonGate = readFileSync(new URL('../platform/python-bridge/avrone_stack/activation_gate.py', import.meta.url), 'utf8');
const pythonSchema = pythonGate.match(/^SCHEMA\s*=\s*["']([^"']+)["']/m);
const pythonMaxAge = pythonGate.match(/^MAX_AGE\s*=\s*timedelta\(hours=(\d+)\)/m);
const requiredBlock = pythonGate.match(/^REQUIRED_CHECKS\s*=\s*\(([\s\S]*?)^\)/m);

assert.ok(pythonSchema, 'Python activation schema must be discoverable');
assert.ok(pythonMaxAge, 'Python activation evidence age must be discoverable');
assert.ok(requiredBlock, 'Python required check list must be discoverable');

const pythonIds = [...requiredBlock[1].matchAll(/^\s*["']([A-Za-z][A-Za-z0-9]+)["'],?\s*$/gm)].map(match => match[1]);
const nodeIds = REQUIRED_CHECKS.map(([id]) => id);
const guideIds = GUIDE_CHECKS.map(([id]) => id);

assert.equal(pythonSchema[1], ACTIVATION_SCHEMA, 'Python and Node evidence schemas must match');
assert.equal(Number(pythonMaxAge[1]), 24, 'Python evidence maximum age must stay at 24 hours');
assert.equal(MAX_EVIDENCE_AGE_MS, 24 * 60 * 60 * 1000, 'Node evidence maximum age must stay at 24 hours');
assert.deepEqual(pythonIds, nodeIds, 'Python executor and Node CLI must require the same gates in the same order');
assert.deepEqual(guideIds, nodeIds, 'Plain-language guide and Node CLI must require the same gates in the same order');
assert.equal(new Set(nodeIds).size, nodeIds.length, 'Gate identifiers must be unique');

console.log('Activation policy parity: PASS (' + nodeIds.length + ' gates; Python, Node, and guide aligned)');
