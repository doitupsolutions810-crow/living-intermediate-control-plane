/**
 * Policy-aware federation gate — only share digests when severity allows.
 */

export function canPublishDigest(securitySeverity, { allowHigh = false } = {}) {
  if (securitySeverity === 'high' && !allowHigh) return false;
  return true;
}

export function peerCapabilityGate(peerDigest, { maxBeliefDelta = 1 } = {}) {
  if (!peerDigest) return { ok: false, reason: 'missing' };
  if (peerDigest.belief != null && (peerDigest.belief < 0 || peerDigest.belief > 1)) {
    return { ok: false, reason: 'belief_out_of_range' };
  }
  return { ok: true, maxBeliefDelta };
}
