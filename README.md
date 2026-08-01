# Living Intermediate Control Plane

Unified lattice · Avrone chat/cockpit · trust network · federation digests · sovereign attestation.

```text
platform/          Node control plane (lattice, policy, TLS, federation, attestation)
avrone-chat/       Next.js Avrone UI + API proxies
scripts/           tunnel / mTLS / renew operators
cloudflared/       tunnel config example
```

## Quick start

```bash
cd platform && npm install && npm start
# optional: CONTROL12_CHAT_OPEN=1 npm start
cd avrone-chat && npm install && npm run dev
```

Set `CONTROL12_PLATFORM_URL` and optional `CONTROL12_PLATFORM_TOKEN` for the chat app.
