export async function runCockpitAction(action, body, ctx) {
  switch (action) {
    case 'tls_reload': {
      if (!ctx.tlsHandle?.setSecureContextFromDisk) {
        throw Object.assign(new Error('TLS not enabled'), { statusCode: 400 });
      }
      return ctx.tlsHandle.setSecureContextFromDisk();
    }
    case 'spectrum':
      return ctx.resonant?.getSpectrum?.() || null;
    case 'belief_tick':
      return ctx.resonant?.tick(body?.belief ?? 0.55) || null;
    case 'federation_publish':
      return ctx.federation?.publishLocal?.() || null;
    case 'observation_publish': {
      if (!ctx.federation?.publishObservation) {
        throw Object.assign(new Error('observation publish not wired'), { statusCode: 400 });
      }
      return ctx.federation.publishObservation({
        belief: body?.belief,
        securitySeverity: body?.securitySeverity || 'ok',
        observationText: body?.observationText || body?.observation || null
      });
    }
    case 'avrone_stack_route': {
      if (!ctx.avroneStack?.route) {
        throw Object.assign(new Error('avrone stack adapter not wired'), { statusCode: 400 });
      }
      return ctx.avroneStack.route({
        message: body?.message || body?.content || '',
        sessionId: body?.session_id || body?.sessionId || null,
        model: body?.model || null,
        temperature: body?.temperature ?? 0.7,
        maxTokens: body?.max_tokens ?? body?.maxTokens ?? null,
        belief: body?.belief != null ? Number(body.belief) : null,
        stream: false
      });
    }
    case 'avrone_stack_probe': {
      if (!ctx.avroneStack?.probe) {
        throw Object.assign(new Error('avrone stack adapter not wired'), { statusCode: 400 });
      }
      return ctx.avroneStack.probe();
    }
    case 'renew_status':
      return ctx.renewStatus?.() || null;
    case 'anomaly':
      return ctx.anomalies?.() || null;
    case 'quorum':
      return ctx.codingQuorum?.run({
        goal: body?.goal || 'cockpit quorum',
        path: body?.path ?? null,
        content: body?.content ?? null,
        command: body?.command ?? null
      });
    case 'attestation_link': {
      if (!ctx.attestationLink) {
        throw Object.assign(new Error('attestation link not wired'), { statusCode: 400 });
      }
      return ctx.attestationLink({
        sessionId: body?.session_id || body?.sessionId,
        turnId: body?.turn_id || body?.turnId,
        latticeObservation: body?.lattice_observation || body?.latticeObservation,
        sbomSha256: body?.sbom_sha256 || body?.sbomSha256
      });
    }
    default:
      throw Object.assign(new Error(`unknown action: ${action}`), { statusCode: 400 });
  }
}
