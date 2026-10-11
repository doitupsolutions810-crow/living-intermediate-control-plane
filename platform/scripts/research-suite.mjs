#!/usr/bin/env node
// Research suite: convergence, cycle stability, stress invariant, hypothesis loop, agent horizon
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { runResearch, convergenceSteps, cycleStability, stressInvariant, hypothesisReport, FIXED } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'bridge', 'great-scale-research.mjs')).href);
const { agentHorizon, ollamaStatus } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'bridge', 'scale-agent.mjs')).href);

const k = Number(process.argv[2] ?? 0.5);
const r = runResearch(k);
console.log(JSON.stringify({ fixedPoint: FIXED, convergence: r.convergence.map(c => ({ start: c.start, steps: c.steps, converged: c.converged, final: +c.final.toFixed(6) })), cycles: r.cycles, stressAt45: r.stress.find(s => s.x === 4.5), hypothesis: r.hypothesis }, null, 2));

const h = await agentHorizon(1.0, 6, k);
console.log('\n--- agent horizon (6 steps from x=1) ---');
for (const t of h.trajectory) console.log(`step ${t.step}: x=${t.x.toFixed(4)} S=${t.hyp.S.toFixed(4)} residual=${t.hyp.residual.toFixed(4)} -> ${t.hyp.support} | ${t.finding.slice(0,110)}...`);
console.log('\nollama:', await ollamaStatus());
