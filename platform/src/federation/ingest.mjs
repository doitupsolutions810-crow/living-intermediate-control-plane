export function createIngestor(store) {
  return {
    async ingestPeer(peerId, digest) {
      if (!peerId || !digest?.digest) {
        throw Object.assign(new Error('peerId and digest required'), { statusCode: 400 });
      }
      store.peers[peerId] = {
        ...digest,
        ingestedAt: new Date().toISOString()
      };
      return store.peers[peerId];
    }
  };
}
