import { buildFederationDigest } from './digest.mjs';

export function createPublisher(store) {
  return {
    async publishLocal(state) {
      const digest = buildFederationDigest(state);
      store.lastPublished = digest;
      return digest;
    }
  };
}
