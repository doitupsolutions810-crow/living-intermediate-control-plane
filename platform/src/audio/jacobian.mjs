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
  for (const [name, value] of [['delta', delta], ['coupling', coupling], ['scale', scale]]) {
    if (!Number.isFinite(Number(value))) throw new TypeError(`${name} must be finite`);
  }
  const d = Number(delta), c = Number(coupling), s = Number(scale);
  const t = tension(b);
  const next = b + s * (d * t + c * (0.5 - b) * 0.05);
  if (!Number.isFinite(next)) throw new RangeError('belief step produced a non-finite result');
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
  if (!Number.isFinite(n)) throw new TypeError('belief input must be finite');
  return Math.max(0, Math.min(1, n));
}

export default { tension, integrateBeliefStep, spectralTilt };
