/**
 * Lattice observation adapter for ReAct-style harnesses.
 * Formats security/status + spectrum + federation as structured observations
 * that AVRONE Python agents can ingest as ReasoningStep.observation.
 */

export function buildLatticeObservation({
  securityStatus = null,
  spectrum = null,
  federationSnapshot = null,
  belief = null,
  nodeId = 'lattice',
  sessionId = null
} = {}) {
  const parts = [];
  const structured = {
    schema: 'control12.lattice-observation/v1',
    nodeId,
    sessionId,
    observedAt: new Date().toISOString(),
    belief: belief == null ? null : Number(belief),
    security: null,
    spectrum: null,
    federation: null
  };

  if (securityStatus && typeof securityStatus === 'object') {
    structured.security = {
      mtls: Boolean(securityStatus.mtls),
      chatOpen: Boolean(securityStatus.chatOpen),
      requireQuorum: Boolean(securityStatus.requireQuorum),
      anomalyCount: Number(securityStatus.anomalyCount ?? securityStatus.anomalies?.count ?? 0),
      renewRequired: Boolean(securityStatus.renew?.reloadRequired ?? securityStatus.reloadRequired),
      severity: securityStatus.severity ?? securityStatus.anomalies?.severity ?? 'unknown'
    };
    parts.push(
      `security: mtls=${structured.security.mtls} quorum=${structured.security.requireQuorum} ` +
        `severity=${structured.security.severity} anomalies=${structured.security.anomalyCount}`
    );
  }

  if (spectrum && typeof spectrum === 'object') {
    structured.spectrum = {
      partials: spectrum.partials ?? spectrum.bins ?? null,
      fundamental: spectrum.fundamental ?? spectrum.f0 ?? null,
      energy: spectrum.energy ?? spectrum.rms ?? null,
      fragment: typeof spectrum.fragment === 'string' ? spectrum.fragment.slice(0, 240) : null
    };
    if (structured.spectrum.fragment) {
      parts.push(`spectrum: ${structured.spectrum.fragment}`);
    } else if (structured.spectrum.fundamental != null) {
      parts.push(`spectrum: f0=${structured.spectrum.fundamental} energy=${structured.spectrum.energy}`);
    }
  }

  if (federationSnapshot && typeof federationSnapshot === 'object') {
    const rawPeers = federationSnapshot.peers ?? federationSnapshot.peerCount ?? null;
    const peerCount =
      typeof rawPeers === 'number'
        ? rawPeers
        : rawPeers && typeof rawPeers === 'object'
          ? Object.keys(rawPeers).length
          : null;
    structured.federation = {
      peers: peerCount,
      lastDigest: federationSnapshot.lastDigest ?? federationSnapshot.digest ?? null,
      publishedAt: federationSnapshot.publishedAt ?? null
    };
    parts.push(
      `federation: peers=${structured.federation.peers ?? '?'} digest=${String(structured.federation.lastDigest || '').slice(0, 16)}`
    );
  }

  if (structured.belief != null) {
    const t = structured.belief * (1 - structured.belief);
    parts.push(`belief=${structured.belief.toFixed(4)} tension=${t.toFixed(4)}`);
  }

  return {
    ...structured,
    observation: parts.join(' | ') || 'lattice: no active sensors',
    provisional: true
  };
}

/**
 * Build a ReAct-compatible step object matching AVRONE ReasoningStep shape.
 */
export function toReactObservationStep(observationPayload, thought = 'Observe lattice state before acting.') {
  return {
    thought,
    action: 'lattice_observe',
    action_input: {
      nodeId: observationPayload.nodeId,
      sessionId: observationPayload.sessionId
    },
    observation: observationPayload.observation,
    structured: observationPayload
  };
}
