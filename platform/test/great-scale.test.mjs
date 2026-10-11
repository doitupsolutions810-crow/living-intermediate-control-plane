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

assert(Math.abs(heat(0.5) - 0.25) < 1e-12, 'heat peak');
assert(Math.abs(heat(0.5) - tension(0.5)) < 1e-12, 'heat ≡ tension');
assert(PHI > 1.6 && PHI < 1.62, 'phi');
assert(CONE > 0 && CONE < 0.4, 'cone');

const st = stateAt(0);
assert(st.phase >= 0 && st.phase < 1, 'phase');
assert(st.psi >= CONE - 1e-9, 'psi above cone');

const map = beliefToScale(0.55);
assert(Math.abs(map.S - tension(0.55)) < 1e-12, 'map tension');
const snap = snapshotFromBelief(0.55);
assert(snap.coherence.tensionEqualsHeat === true, 'coherence flag');
assert(snap.xyz.length === 3, 'xyz');

console.log('great-scale.test.mjs PASS');
