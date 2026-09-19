# Living Intermediate Control Plane

Unified lattice · Avrone chat/cockpit · trust network · federation digests · sovereign attestation.

```text
platform/          Node control plane (lattice, policy, TLS, federation, attestation)
avrone-chat/       Next.js Avrone UI + API proxies (Vercel-ready)
scripts/           tunnel / mTLS / renew operators
cloudflared/       tunnel config example
lib/evidence-console.mjs   graceful public evidence probe (404 → local authority)
```

## Quick start

```bash
cd platform && npm install && npm start
# optional: CONTROL12_CHAT_OPEN=1 npm start
cd avrone-chat && npm install && npm run dev
```

Set `CONTROL12_PLATFORM_URL` and optional `CONTROL12_PLATFORM_TOKEN` for the chat app.  
Optional: `EVIDENCE_CONSOLE_URL` — when unset or 404, cockpit/integrate use local plane authority.

## Operator loop

```bash
npm test
npm run procure          # ACCEPT_LOCAL_EVIDENCE=1
npm run report
npm run continuous       # optional always-on readiness
```

## Avrone on Vercel

Root Directory: `avrone-chat`. Copy env from `avrone-chat/.env.example`. See `avrone-chat/README.md`.

## External blockers

- Public evidence-console domain still 404s
- GitHub Actions automatic runs disabled at account level
