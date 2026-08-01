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
    default:
      throw Object.assign(new Error(`unknown action: ${action}`), { statusCode: 400 });
  }
}
