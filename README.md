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

## Quantum-geometry research bridge

The additive QGT bridge is covered by `platform/test/quantum-geometry.test.mjs`. The follow-on [Descent LXXVIII](docs/descent-lxxviii-topological-qgt.md) demonstrates why a local scalar residual cannot encode the global Chern number of a two-band model. [Descent LXXXVIII — curvature-sign variance and cancellation](platform/research/DESCENT_LXXXVIII_CURVATURE_SIGN_VARIANCE.md) derives a global variance interpretation and adds cancellation-identity checks. [Descent LXXXIX — orientation blindness and identifiability](platform/research/DESCENT_LXXXIX_ORIENTATION_IDENTIFIABILITY.md) adds signed polarization and regression coverage for orientation reversal. [Descent XC — curvature-orientation entropy](platform/research/DESCENT_XC_CURVATURE_ORIENTATION_ENTROPY.md) adds a Shannon-entropy diagnostic and a cross-check against sampled curvature budgets. Root `npm test` now includes `npm --prefix platform test` so the platform regression suite is in the standard test command.

## Avrone on Vercel

Root Directory: `avrone-chat`. Copy env from `avrone-chat/.env.example`. See `avrone-chat/README.md`.

## External blockers

- Public evidence-console domain still 404s
- GitHub Actions automatic runs disabled at account level
