import { createPublisher } from '../../federation/publish.mjs';
import { createIngestor } from '../../federation/ingest.mjs';
import { canPublishDigest } from '../../federation/policy-sync.mjs';
import { hashObservation } from '../../federation/digest.mjs';

export function createFederationApi(store, getLocalState) {
  const publisher = createPublisher(store);
  const ingestor = createIngestor(store);

  return {
    snapshot: () => ({ ...store }),
    async publish(securitySeverity = 'ok') {
      const allowHigh =
        process.env.CONTROL12_CHAT_OPEN === '1' ||
        process.env.CONTROL12_FEDERATION_ALLOW_HIGH === '1';
      if (!canPublishDigest(securitySeverity, { allowHigh })) {
        throw Object.assign(new Error('publish blocked by security severity'), {
          statusCode: 403
        });
      }
      const state = getLocalState();
      return publisher.publishLocal({ ...state, securitySeverity });
    },
    async publishObservation({ belief, securitySeverity = 'ok', observationText = null } = {}) {
      const allowHigh =
        process.env.CONTROL12_CHAT_OPEN === '1' ||
        process.env.CONTROL12_FEDERATION_ALLOW_HIGH === '1';
      if (!canPublishDigest(securitySeverity, { allowHigh })) {
        throw Object.assign(new Error('publish blocked by security severity'), {
          statusCode: 403
        });
      }
      const state = getLocalState();
      const observationDigest = observationText ? hashObservation(observationText) : null;
      return publisher.publishLocal({
        ...state,
        belief: belief != null ? Number(belief) : state.belief,
        securitySeverity,
        observationDigest
      });
    },
    ingest: (peerId, digest) => ingestor.ingestPeer(peerId, digest)
  };
}
