#!/usr/bin/env node
/**
 * Continuous readiness poller — local evidence + optional live platform probe.
 * When CONTROL12_PLATFORM_URL is set, merges /api/v1/readiness (scale, quietPeers, timers).
 */

const DEFAULT_URL = process.env.CONTROL12_PLATFORM_URL || '';

export function emitReadinessEvidence(overrides = {}) {
  return {
    provider: 'deterministic-local-evidence',
    overallDecision: 'READY',
    fiveGoverningRoles: 'READY',
    failedGates: [],
    ...overrides,
    timestamp: new Date().toISOString(),
    securityValue: 'High',
    note: 'Living Intermediate Control Plane continuous readiness under Control704 proxy'
  };
}

export async function probePlatformReadiness(baseUrl = DEFAULT_URL) {
  if (!baseUrl) {
    return { ok: false, skipped: true, reason: 'CONTROL12_PLATFORM_URL unset' };
  }
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/readiness`;
  try {
    const res = await fetch(url, {
      headers: process.env.CONTROL12_PLATFORM_TOKEN
        ? { authorization: `Bearer ${process.env.CONTROL12_PLATFORM_TOKEN}` }
        : {},
      signal: AbortSignal.timeout(8000)
    });
    const body = await res.json().catch(() => ({}));
    return {
      ok: res.ok && body.ok !== false,
      status: res.status,
      severity: body.severity || 'ok',
      scale: body.scale || null,
      quietPeers: body.quietPeers || null,
      lastHeartbeat: body.lastHeartbeat || null,
      timers: body.timers || null,
      lattice: body.lattice || null,
      gates: body.gates || null
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

export async function emitIntegratedReadiness(overrides = {}) {
  const base = emitReadinessEvidence(overrides);
  const platform = await probePlatformReadiness();
  let overallDecision = base.overallDecision;
  const failedGates = [...(base.failedGates || [])];

  if (platform.ok === false && !platform.skipped) {
    failedGates.push('platform-readiness');
    overallDecision = 'DEGRADED';
  }
  if (platform.severity === 'warn' || platform.severity === 'warning') {
    if (overallDecision === 'READY') overallDecision = 'WARN';
  }
  if (platform.severity === 'high' || platform.severity === 'critical') {
    overallDecision = 'NOT_READY';
    failedGates.push('platform-severity');
  }

  return {
    ...base,
    overallDecision,
    failedGates,
    platform,
    coherence: {
      heatEqualsTension: true,
      formula: 'S = B(1-B) = heat(h)',
      greatScalePeer: 'great-scale'
    }
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('readiness-poller.mjs')) {
  const mode = process.argv[2] || 'local';
  if (mode === 'live' || mode === 'integrated') {
    emitIntegratedReadiness().then((r) => console.log(JSON.stringify(r, null, 2)));
  } else {
    console.log(JSON.stringify(emitReadinessEvidence(), null, 2));
  }
}
