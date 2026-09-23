/**
 * Unit tests for lattice observation + adapter (no network).
 */
import { buildLatticeObservation, toReactObservationStep } from '../src/bridge/lattice-observation.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const obs = buildLatticeObservation({
  securityStatus: {
    mtls: true,
    chatOpen: false,
    requireQuorum: true,
    anomalyCount: 0,
    severity: 'ok'
  },
  spectrum: { fragment: 'f0=528 energy=0.12', fundamental: 528, energy: 0.12 },
  federationSnapshot: { peers: 1, lastDigest: 'abc123def456' },
  belief: 0.55,
  nodeId: 'test-node',
  sessionId: 'sess-1'
});

assert(obs.schema === 'control12.lattice-observation/v1', 'schema');
assert(obs.provisional === true, 'provisional');
assert(obs.belief === 0.55, 'belief');
assert(obs.security?.mtls === true, 'mtls');
assert(obs.observation.includes('security:'), 'obs security');
assert(obs.observation.includes('spectrum:'), 'obs spectrum');
assert(obs.observation.includes('belief=0.5500'), 'obs belief');

const step = toReactObservationStep(obs);
assert(step.action === 'lattice_observe', 'action');
assert(typeof step.observation === 'string' && step.observation.length > 0, 'step obs');
assert(step.structured?.nodeId === 'test-node', 'structured node');

const empty = buildLatticeObservation({});
assert(empty.observation === 'lattice: no active sensors', 'empty');

console.log('bridge-observation.test.mjs PASS');
