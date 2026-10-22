import {
  heat,
  PHI,
  CONE,
  stateAt,
  beliefToScale,
  snapshotFromBelief
} from '../src/bridge/great-scale.mjs';
import { tension } from '../src/audio/jacobian.mjs';

function assert(c, m) {
  if (!c) throw new Error(m || 'fail');
}

function assertThrows(fn, pattern) {
  let error = null;
  try { fn(); } catch (e) { error = e; }
  if (!error) throw new Error('expected function to throw');
  if (pattern && !pattern.test(error.message)) {
    throw new Error(`unexpected error message: ${error.message}`);
  }
}

assert(Math.abs(heat(0.5) - 0.25) < 1e-12, 'heat peak');
assert(Math.abs(heat(0.5) - tension(0.5)) < 1e-12, 'heat ≡ tension');
assert(PHI > 1.6 && PHI < 1.62, 'phi');
assert(Math.abs(CONE - (PHI - 1) ** 2) < 1e-12, 'cone matches Great Scale φ⁻²');

const st = stateAt(0);
const negative = stateAt(-1, 0.85);
const equivalent = stateAt(0.15 / 0.85, 0.85);
assert(negative.phase >= 0 && negative.phase < 1, 'negative time phase is canonical');
assert(Math.abs(negative.phase - equivalent.phase) < 1e-12, 'negative-time phase periodicity');
assert(Math.abs(negative.h - equivalent.h) < 1e-12, 'negative-time height periodicity');
assertThrows(() => stateAt(Number.NaN), /finite/);
assertThrows(() => stateAt(Number.POSITIVE_INFINITY), /finite/);
assertThrows(() => stateAt(Number.MAX_VALUE, 2), /phase product/);
assert(st.phase >= 0 && st.phase < 1, 'phase');
assert(st.psi >= CONE - 1e-9, 'psi above cone');

const map = beliefToScale(0.55);
assert(Math.abs(map.S - tension(0.55)) < 1e-12, 'map tension');
const snap = snapshotFromBelief(0.55);
assert(snap.coherence.tensionEqualsHeat === true, 'coherence flag');
assert(snap.xyz.length === 3, 'xyz');

console.log('great-scale.test.mjs PASS');
