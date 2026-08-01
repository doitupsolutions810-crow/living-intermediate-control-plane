/**
 * Client helper to publish/ingest federation digests against a remote platform.
 */

export class FederationClient {
  constructor({ baseUrl, token = '' }) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.token = token;
  }

  headers() {
    const h = { 'content-type': 'application/json' };
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }

  async publish() {
    const res = await fetch(`${this.baseUrl}/api/v1/federation/publish`, {
      method: 'POST',
      headers: this.headers(),
      body: '{}'
    });
    if (!res.ok) throw new Error(`publish failed: ${res.status}`);
    return res.json();
  }

  async ingest(peerId, digest) {
    const res = await fetch(`${this.baseUrl}/api/v1/federation/ingest`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ peerId, digest })
    });
    if (!res.ok) throw new Error(`ingest failed: ${res.status}`);
    return res.json();
  }

  async snapshot() {
    const res = await fetch(`${this.baseUrl}/api/v1/federation/snapshot`, {
      headers: this.headers()
    });
    if (!res.ok) throw new Error(`snapshot failed: ${res.status}`);
    return res.json();
  }
}
