# Project Avrone — operator knowledge base

Retained configuration map for finishing a **successful, functional** Avrone deploy.

## Source of truth

| Item | Value |
|------|--------|
| Repo | `doitupsolutions810-crow/living-intermediate-control-plane` |
| Finish branch | `finish/avrone-ship-ready` |
| Finish PR | https://github.com/doitupsolutions810-crow/living-intermediate-control-plane/pull/1 |
| Front door | `avrone-chat/` (Next.js) |
| Control plane | `platform/` + root `integrate.mjs` |

## Functional config (env)

Copy `avrone-chat/.env.example` → `avrone-chat/.env.local` (local) or Vercel Project Env (deploy).

| Variable | Required | Purpose |
|----------|----------|----------|
| `CONTROL12_PLATFORM_URL` | Recommended | Platform base URL (default local `http://127.0.0.1:8787`) |
| `CONTROL12_PLATFORM_TOKEN` | If platform auth on | Bearer/token for platform APIs — **never commit** |
| `EVIDENCE_CONSOLE_URL` | Optional | Public evidence-console; on unset/404/unreachable → **local authority** |

## Vercel (ship Avrone chat)

1. Project should track **this repo**, not `CycleKernal`.
2. **Root Directory:** `avrone-chat`
3. Framework: Next.js (see `avrone-chat/vercel.json`)
4. Region: `iad1` (as configured)
5. Set env vars from the table above in Vercel → Settings → Environment Variables
6. Redeploy production after env + git connection are correct

**Current live note (2026-09-19):** https://avrone-due-krey-chat.vercel.app is Ready but the Vercel project was still linked to `CycleKernal`. Until rewired, merging this PR will not auto-update that deployment.

## Local verify

```bash
npm test
npm run procure
npm run report
cd avrone-chat && npm install && npm run typecheck && npm run build && npm run dev
```

## CI / checks reality

- **Actions** workflows exist (`.github/workflows/plane-ci.yml`); treat recent run history as source of truth.
- **Snyk** may fail with org **private test quota** — that is an account limit, not an Avrone code defect.
- Prefer green `npm test` / typecheck / build over waiting on Snyk quota.

## Evidence / readiness

- Success criteria: see `docs/system-success-criteria.md`
- Next actions: see `docs/next-actions.md`
- Public evidence-console 404 is expected until the domain is healthy; local plane authority is the temporary path (`ACCEPT_LOCAL_EVIDENCE` / unset URL grace in `lib/evidence-console.mjs`).

## Non-goals (do not expand finish scope)

- New worker images
- Full G1–G6 production acceptance
- Expanding the five roles
- Becoming a large public platform

## Skills (Grok Bot)

- [Claim ChatGPT Plus free trial](sand-workflow:claim-chatgpt-plus-free-trial) — optional, skipped for Avrone finish
- [Review GitHub PR before merge](sand-workflow:review-github-pr-before-merge) — Actions → Files changed → confirm before merge
