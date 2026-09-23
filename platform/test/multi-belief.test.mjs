import { MultiBeliefGraph } from '../src/bridge/multi-belief.mjs';

function assert(c, m) {
  if (!c) throw new Error(m || 'fail');
}

async function main() {
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

  const edgesBefore = g.edges[0].weight;
  g.applyOutcome('a', 'accept', 0.05);
  assert(g.edges[0].weight > edgesBefore, 'edge strengthen');
  g.applyOutcome('a', 'reject', 0.05);
  assert(g.edges[0].weight <= edgesBefore + 1e-9, 'edge weaken');

  const tmp = '/tmp/c12-belief-graph-test.json';
  await g.saveTo(tmp);
  const g2 = new MultiBeliefGraph();
  const loaded = await g2.loadFrom(tmp);
  assert(loaded && loaded.nodes.length >= 2, 'load nodes');
  const merged = g2.mergeFederatedPeer('peer-x', {
    meanBelief: 0.7,
    multiBeliefDigest: 'abc'
  });
  assert(merged.node.id === 'peer-x', 'merge peer');
  assert(g2.nodes.has('peer-x'), 'peer in graph');

  console.log('multi-belief.test.mjs PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
