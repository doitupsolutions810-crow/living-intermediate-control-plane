import { hypothesisReport, FIXED } from './great-scale-research.mjs';

const OLLAMA = process.env.CONTROL12_OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL  = process.env.CONTROL12_OLLAMA_MODEL || 'tinyllama';

export const MAIN_HYPOTHESIS = 'S(h)=h(1-h) ≡ T(B)=B(1-B); f(x)=9-(x mod 9), involution f(f(x))=x; fixed point x*=4.5; two-cycles (1,8)(2,7)(3,6)(4,5); cone floor; phi zero-mode; stress = moment of now computationally; recursive observation: geometry generates the scale that observes it. No certainty — always another perspective.';

async function ollamaGenerate(prompt, timeoutMs = 8000){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl abort(), timeoutMs);
  try{
    const r = await fetch(`${OLLAMA}/api/generate`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ model: MODEL, prompt, stream:false, options:{ num_predict: 120 } }), signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.response ?? null;
  }catch{ clearTimeout(t); return null; }
}

export async function agentObserve(x){
  const hyp = hypothesisReport(x);
  const det = `x=${x.toFixed(4)} S=${hyp.S.toFixed(4)} residual=${hyp.residual.toFixed(4)} -> ${hyp.support.toUpperCase()} the hypothesis. Fixed point 4.5; involution pairs intact; heat modest near mid-coherence.`;
  if (process.env.CONTROL12_HORIZON_OLLAMA === '1'){
    const p = `You are a Great Scale research agent. Main hypothesis: ${MAIN_HYPOTHESIS}\nCurrent state: x=${x}, S=${hyp.S.toFixed(4)}, residual=${hyp.residual.toFixed(4)}.\nGive one concise finding (1-2 sentences) about whether the descent supports or tensions the hypothesis.`;
    const llm = await ollamaGenerate(p);
    if (llm) return { source:'ollama', finding: llm.trim(), hyp };
  }
  return { source:'deterministic', finding: det, hyp };
}

export async function agentHorizon(start, steps = 5, k = 0.5){
  let x = start; const out = [];
  for (let i=0;i<steps;i++){
    x = FIXED + (x - FIXED) * Math.cos(Math.PI * k);
    const obs = await agentObserve(x);
    out.push({ step:i+1, x, ...obs });
  }
  return { start, steps, k, trajectory: out, hypothesis: MAIN_HYPOTHESIS };
}

export async function ollamaStatus(){
  try{
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return { ok:false, url:OLLAMA };
    const j = await r.json();
    return { ok:true, url:OLLAMA, models:(j.models||[]).map(m=>m.name) };
  }catch{ return { ok:false, url:OLLAMA }; }
}

export default { MAIN_HYPOTHESIS, agentObserve, agentHorizon, ollamaStatus };
