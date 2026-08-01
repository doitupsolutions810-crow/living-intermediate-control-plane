/**
 * Jacobian of belief — tension and soft step helpers.
 * T = B(1-B); steps remain provisional (never claims certainty).
 */

export function tension(belief) {
  const b = clamp01(belief);
  return b * (1 - b);
}

export function integrateBeliefStep(belief, { delta = 0, coupling = 0, scale = 1 } = {}) {
  const b = clamp01(belief);
  const t = tension(b);
  const next = b + scale * (delta * t + coupling * (0.5 - b) * 0.05);
  return clamp01(next);
}

export function spectralTilt(belief, partialIndex, baseAmp = 1) {
  const b = clamp01(belief);
  const falloff = 1 / Math.sqrt(Math.max(1, partialIndex));
  const tilt = 0.5 + b * 0.5;
  return baseAmp * falloff * tilt;
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export default { tension, integrateBeliefStep, spectralTilt };
