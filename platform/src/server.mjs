import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.mjs';
import { ResonantBridge } from './audio/resonant-bridge.mjs';
import { CodingAgent } from './agents/coding-agent.mjs';
import { CodingQuorum } from './agents/coding-quorum.mjs';
import { readJson, requireAuth, requireAuthUnlessChatOpen, sendJson, sendOptions } from './http/router.mjs';
import { createAppServer, installTlsReloadSignal } from './security/create-server.mjs';
import { AccessLogger } from './security/access-logger.mjs';
import { analyzeAccessLog } from './security/anomaly-detector.mjs';
import { runRenewRespond } from './security/renew-loop.mjs';
import { ChatWire } from './bridge/chat-wire.mjs';
import { runCockpitAction } from './cockpit/action.mjs';
import { createFederationApi } from './api/federation/index.mjs';
import { createAttestationApi } from './api/attestation/index.mjs';
import { ComponentRegistry } from './attestation/component-registry.mjs';

await fs.mkdir(config.root, { recursive: true });
await fs.mkdir(config.workspace, { recursive: true });
await fs.mkdir(config.attestationDir, { recursive: true });

const resonant = new ResonantBridge({ label: 'living-intermediate' });
const coding = new CodingAgent({
  workspaceRoot: config.workspace,
  policyOptions: {
    maxWriteBytes: Number(process.env.CONTROL12_CODE_MAX_WRITE_BYTES || 512_000)
  }
});
const codingQuorum = new CodingQuorum({
  coding,
  attestationDir: config.attestationDir
});
const chatWire = new ChatWire({ resonant });
const accessLog = new AccessLogger(config.accessLog);
const registry = new ComponentRegistry(path.join(config.root, 'components.json'));

await registry.register({
  id: 'audio.living-intermediate',
  version: config.version,
  kind: 'audio'
});
await registry.register({ id: 'code.workspace', version: config.version, kind: 'code' });
await registry.register({ id: 'federation.hub', version: config.version, kind: 'federation' });

const fedStore = { peers: {}, lastPublished: null };
const federation = createFederationApi(fedStore, () => {
  const s = resonant.getState();
  return {
    belief: s.belief,
    tension: s.tension,
    partialCount: s.partials?.length || 0,
    label: process.env.CONTROL12_FEDERATION_LABEL || 'local'
  };
});

const attestation = createAttestationApi({
  registry,
  policySnapshot: coding.getPolicySnapshot()
});

const tlsHandle = { current: null };

const handler = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const hasBearer = Boolean((req.headers.authorization || '').match(/^Bearer\s+\S+/i));
  accessLog.instrument(req, res, {
    path: url.pathname,
    auth: hasBearer ? 'bearer' : config.chatOpen ? 'chat-open' : 'none'
  });

  try {
    if (req.method === 'OPTIONS') return sendOptions(res);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, {
        ok: true,
        version: config.version,
        chatOpen: config.chatOpen,
        requireQuorum: config.requireQuorum,
        mtls: config.mtls
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/audio/state') {
      return sendJson(res, 200, resonant.getState());
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/audio/spectrum') {
      return sendJson(res, 200, resonant.getSpectrum());
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/audio/prompt') {
      return sendJson(res, 200, { fragment: resonant.toPromptFragment() });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/code/policy') {
      return sendJson(res, 200, {
        ...coding.getPolicySnapshot(),
        requireQuorum: config.requireQuorum,
        chatOpen: config.chatOpen
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/federation/snapshot') {
      return sendJson(res, 200, federation.snapshot());
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/attestation/sbom') {
      return sendJson(res, 200, await attestation.sbom());
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/attestation/statement') {
      return sendJson(res, 200, await attestation.statement());
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/attestation/policy') {
      return sendJson(res, 200, attestation.policyDigest());
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/security/anomalies') {
      return sendJson(res, 200, await analyzeAccessLog(config.accessLog));
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/security/renew') {
      return sendJson(res, 200, await runRenewRespond({ accessLog: config.accessLog }));
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/components') {
      return sendJson(res, 200, await registry.list());
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/chat/tools') {
      return sendJson(res, 200, { tools: ChatWire.toolDescriptors() });
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/chat/session') {
      requireAuthUnlessChatOpen(req, config.apiToken, config.chatOpen);
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 201, chatWire.createSession(body));
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/chat/turn') {
      requireAuthUnlessChatOpen(req, config.apiToken, config.chatOpen);
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, chatWire.prepareTurn(body.sessionId, body));
    }

    if (req.method === 'POST') requireAuth(req, config.apiToken);

    if (req.method === 'POST' && url.pathname === '/api/v1/audio/tick') {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, resonant.tick(body.belief, body.otherBelief));
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/audio/silence') {
      return sendJson(res, 200, resonant.silence());
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/code/write') {
      const body = await readJson(req, config.maxBodyBytes);
      if (config.requireQuorum) {
        return sendJson(
          res,
          200,
          await codingQuorum.run({
            goal: body.goal || `write ${body.path}`,
            path: body.path,
            content: body.content ?? ''
          })
        );
      }
      return sendJson(res, 200, await coding.writeFile(body.path, body.content ?? ''));
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/code/quorum') {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await codingQuorum.run(body));
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/terminal') {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await coding.execute(body.command, { cwd: body.cwd }));
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/federation/publish') {
      const anomalies = await analyzeAccessLog(config.accessLog);
      return sendJson(res, 200, await federation.publish(anomalies.severity));
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/federation/ingest') {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await federation.ingest(body.peerId, body.digest));
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/cockpit/action') {
      const body = await readJson(req, config.maxBodyBytes);
      const result = await runCockpitAction(body.action, body, {
        tlsHandle: tlsHandle.current,
        resonant,
        codingQuorum,
        federation: {
          publishLocal: () => federation.publish('ok')
        },
        renewStatus: () => runRenewRespond({ accessLog: config.accessLog }),
        anomalies: () => analyzeAccessLog(config.accessLog)
      });
      return sendJson(res, 200, { action: body.action, result });
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/security/tls/reload') {
      if (!tlsHandle.current?.setSecureContextFromDisk) {
        return sendJson(res, 400, { error: 'TLS not enabled' });
      }
      return sendJson(res, 200, await tlsHandle.current.setSecureContextFromDisk());
    }

    return sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: error.message, code: error.code });
  }
};

const handle = createAppServer(handler);
tlsHandle.current = handle;
installTlsReloadSignal(handle);

handle.server.listen(config.port, config.host, () => {
  console.log(
    `Living Intermediate v${config.version} on ${handle.mode}://${config.host}:${config.port}`
  );
  console.log(`chatOpen=${config.chatOpen} requireQuorum=${config.requireQuorum} mtls=${handle.mtls}`);
});
