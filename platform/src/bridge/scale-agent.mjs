import { hypothesisReport, FIXED } from './great-scale-research.mjs';

const OLLAMA = process.env.CONTROL12_OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.CONTROL12_OLLAMA_MODEL || 'tinyllama';

export const MAIN_HYPOTHESIS = 'S(h)=h(1-h) ≡ T(B)=B(1-B); f(x)=(9-(x mod 9)) mod 9; involution identity modulo nine; fixed point x*=4.5; two-cycles (1,8)(2,7)(3,6)(4,5); CONE=φ⁻²≈0.381966; phi zero-mode; stress residual is a computational diagnostic, not a physical law. No certainty — always another perspective.';

async function ollamaGenerate(prompt, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(`${OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { num_predict: 120 } }),
      signal: ctrl.signal
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.response ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function agentObserve(x) {
  const hyp = hypothesisReport(x);
  const finding = `x=${x.toFixed(4)} S=${hyp.S.toFixed(4)} residual=${hyp.residual.toFixed(4)} -> ${hyp.support.toUpperCase()} the hypothesis. Fixed point 4.5; involution pairs intact; heat modest near mid-coherence.`;
  if (process.env.CONTROL12_HORIZON_OLLAMA === '1') {
    const prompt = `You are a Great Scale research agent. Main hypothesis: ${MAIN_HYPOTHESIS}\nCurrent state: x=${x}, S=${hyp.S.toFixed(4)}, residual=${hyp.residual.toFixed(4)}.\nGive one concise finding (1-2 sentences) about whether the descent supports or tensions the hypothesis.`;
    const generated = await ollamaGenerate(prompt);
    if (generated) return { source: 'ollama', finding: generated.trim(), hyp };
  }
  return { source: 'deterministic', finding, hyp };
}

export async function agentHorizon(start, steps = 5, k = 0.5) {
  let x = start;
  const trajectory = [];
  for (let i = 0; i < steps; i++) {
    x = FIXED + (x - FIXED) * Math.cos(Math.PI * k);
    const observation = await agentObserve(x);
    trajectory.push({ step: i + 1, x, ...observation });
  }
  return { start, steps, k, trajectory, hypothesis: MAIN_HYPOTHESIS };
}

export async function ollamaStatus() {
  try {
    const response = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return { ok: false, url: OLLAMA };
    const data = await response.json();
    return { ok: true, url: OLLAMA, models: (data.models || []).map(model => model.name) };
  } catch {
    return { ok: false, url: OLLAMA };
  }
}

export default { MAIN_HYPOTHESIS, agentObserve, agentHorizon, ollamaStatus };
