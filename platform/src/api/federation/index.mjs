import { createPublisher } from '../../federation/publish.mjs';
import { createIngestor } from '../../federation/ingest.mjs';
import { canPublishDigest } from '../../federation/policy-sync.mjs';

export function createFederationApi(store, getLocalState) {
  const publisher = createPublisher(store);
  const ingestor = createIngestor(store);

  return {
    snapshot: () => ({ ...store }),
    async publish(securitySeverity = 'ok') {
      if (!canPublishDigest(securitySeverity)) {
        throw Object.assign(new Error('publish blocked by security severity'), {
          statusCode: 403
        });
      }
      const state = getLocalState();
      return publisher.publishLocal({ ...state, securitySeverity });
    },
    ingest: (peerId, digest) => ingestor.ingestPeer(peerId, digest)
  };
}
