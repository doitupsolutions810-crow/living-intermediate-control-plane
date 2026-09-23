import { MultiBeliefGraph } from '../src/bridge/multi-belief.mjs';

function assert(c, m) {
  if (!c) throw new Error(m || 'fail');
}

const g = new MultiBeliefGraph({
  nodes: [
    { id: 'a', belief: 0.4 },
    { id: 'b', belief: 0.7 }
  ],
  edges: [{ from: 'a', to: 'b', weight: 0.5 }]
});

const snap = g.snapshot();
assert(snap.nodes.length === 2, 'nodes');
assert(snap.joint.nodeCount === 2, 'joint');
assert(snap.joint.bins.length === 8, 'bins');

const updates = g.stepAll({ delta: 0.01, scale: 1 });
assert(updates.length === 2, 'updates');
assert(updates.every((u) => u.belief >= 0 && u.belief <= 1), 'clamp');

const d = g.digest();
assert(typeof d === 'string' && d.length === 64, 'digest');

console.log('multi-belief.test.mjs PASS');
