# Living Intermediate Control Plane

Unified lattice · Avrone chat/cockpit · trust network · federation digests · sovereign attestation.

```text
platform/          Node control plane (lattice, policy, TLS, federation, attestation)
avrone-chat/       Next.js Avrone UI + API proxies (Vercel-ready)
scripts/           tunnel / mTLS / renew operators
cloudflared/       tunnel config example
lib/evidence-console.mjs   evidence-console reachability probe with explicit unverified fallback
```

## Quick start

```bash
cd platform && npm install && npm start
# optional: CONTROL12_CHAT_OPEN=1 npm start
cd avrone-chat && npm install && npm run dev
```

Set `CONTROL12_PLATFORM_URL` and optional `CONTROL12_PLATFORM_TOKEN` for the chat app.  
Optional: `EVIDENCE_CONSOLE_URL` — when unset or unavailable, local plane status remains an operational fallback only. Endpoint reachability and local status never validate claim contents, provenance, or scientific conclusions.

To proxy CycleKernal's Great Scale snapshot, configure `CYCLEKERNEL_SCALE_URL` to its `/api/v1/scale/state` endpoint and `CYCLEKERNEL_SCALE_TOKEN` to the matching service token. Also set `CONTROL12_PLATFORM_TOKEN`: the LICP scale route requires it when upstream proxying is enabled. The bridge validates the `great-scale.descent/v0.4.2` response, bounds response size, rejects redirects and non-loopback cleartext URLs, and returns an error rather than substituting local readiness data when the upstream fails. This is bearer-token service authentication; it does not claim SPIFFE attestation or mTLS identity.

When both CycleKernal settings are unset, the existing local readiness response remains available under its distinct `great-scale.readiness/v1` schema; it is not evidence that the CycleKernal connection is active. Configure both settings to enable the authenticated upstream snapshot.

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
