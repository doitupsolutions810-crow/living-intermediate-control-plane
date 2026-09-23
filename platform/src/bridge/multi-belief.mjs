/**
 * Multi-belief graph — nodes with weighted edges; joint spectrum tilt.
 * Provisional structure for relational coupling across lattice nodes.
 */

import { tension, integrateBeliefStep, spectralTilt } from '../audio/jacobian.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export class MultiBeliefGraph {
  constructor({ nodes = [], edges = [] } = {}) {
    this.nodes = new Map();
    for (const n of nodes) {
      this.upsertNode(n);
    }
    this.edges = [];
    for (const e of edges) {
      this.addEdge(e.from, e.to, e.weight ?? 0.1);
    }
  }

  upsertNode({ id, belief = 0.55, label = null } = {}) {
    if (!id) throw new Error('node id required');
    const b = Number(belief);
    this.nodes.set(String(id), {
      id: String(id),
      belief: Number.isFinite(b) ? Math.max(0, Math.min(1, b)) : 0.55,
      label: label || String(id),
      tension: tension(belief)
    });
    return this.nodes.get(String(id));
  }

  addEdge(from, to, weight = 0.1) {
    const w = Number(weight);
    this.edges.push({
      from: String(from),
      to: String(to),
      weight: Number.isFinite(w) ? w : 0.1
    });
  }

  meanNeighbor(id) {
    const idStr = String(id);
    const nbrs = this.edges.filter((e) => e.from === idStr || e.to === idStr);
    if (!nbrs.length) return null;
    let sum = 0;
    let wsum = 0;
    for (const e of nbrs) {
      const otherId = e.from === idStr ? e.to : e.from;
      const other = this.nodes.get(otherId);
      if (!other) continue;
      sum += other.belief * e.weight;
      wsum += e.weight;
    }
    return wsum > 0 ? sum / wsum : null;
  }

  stepAll({ delta = 0, scale = 1 } = {}) {
    const updates = [];
    for (const [id, node] of this.nodes) {
      const other = this.meanNeighbor(id);
      const coupling = other != null ? other - 0.5 : 0;
      const next = integrateBeliefStep(node.belief, {
        delta,
        coupling: coupling * 2,
        scale
      });
      node.belief = next;
      node.tension = tension(next);
      updates.push({ id, belief: next, tension: node.tension, meanNeighbor: other });
    }
    return updates;
  }

  jointSpectrum({ partials = 8 } = {}) {
    const nodes = [...this.nodes.values()];
    if (!nodes.length) return { bins: [], meanBelief: 0.5 };
    const meanBelief = nodes.reduce((s, n) => s + n.belief, 0) / nodes.length;
    const bins = [];
    for (let i = 1; i <= partials; i++) {
      bins.push({
        index: i,
        amp: spectralTilt(meanBelief, i, 1)
      });
    }
    return {
      meanBelief,
      meanTension: tension(meanBelief),
      nodeCount: nodes.length,
      bins
    };
  }

  snapshot() {
    return {
      schema: 'control12.multi-belief/v1',
      at: new Date().toISOString(),
      nodes: [...this.nodes.values()],
      edges: this.edges,
      joint: this.jointSpectrum()
    };
  }

  applyOutcome(nodeId, outcome = 'accept', magnitude = 0.02) {
    const id = String(nodeId);
    const sign = String(outcome).toLowerCase() === 'reject' || outcome === 'down' ? -1 : 1;
    const mag = Math.max(0, Math.min(0.2, Number(magnitude) || 0.02));
    for (const e of this.edges) {
      if (e.from === id || e.to === id) {
        e.weight = Math.max(0.01, Math.min(1, e.weight + sign * mag));
      }
    }
    return this.edges.filter((e) => e.from === id || e.to === id);
  }

  async saveTo(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const payload = this.snapshot();
    payload.persistedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  async loadFrom(filePath) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(raw);
      this.nodes.clear();
      this.edges = [];
      for (const n of data.nodes || []) {
        this.upsertNode(n);
      }
      for (const e of data.edges || []) {
        this.addEdge(e.from, e.to, e.weight);
      }
      return this.snapshot();
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      throw err;
    }
  }

  mergeFederatedPeer(peerId, digest = {}) {
    const id = String(peerId || digest.label || 'peer');
    const belief =
      digest.meanBelief != null
        ? Number(digest.meanBelief)
        : digest.belief != null
          ? Number(digest.belief)
          : 0.55;
    const node = this.upsertNode({ id, belief, label: id });
    if (
      this.nodes.has('local') &&
      !this.edges.some(
        (e) => (e.from === 'local' && e.to === id) || (e.from === id && e.to === 'local')
      )
    ) {
      this.addEdge('local', id, 0.15);
    }
    return {
      node,
      multiBeliefDigest: digest.multiBeliefDigest || null,
      snapshot: this.snapshot()
    };
  }

  digest() {
    const body = JSON.stringify(this.snapshot());
    return crypto.createHash('sha256').update(body).digest('hex');
  }
}

export default MultiBeliefGraph;
