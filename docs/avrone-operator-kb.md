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
| `XAI_API_KEY` / `OPENAI_API_KEY` | For agent mode | LLM for tool-using chat loop |
| `TAVILY_API_KEY` | Optional | `web_search` |
| `AVRONE_SHELL_ENABLED` | Optional | Shell sandbox; keep off on Vercel |

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



## Agent tools (Grok-class loop)

Chat route (`avrone-chat/app/api/chat/route.ts`) runs a multi-step tool loop when an LLM key is present.

| Variable | Required | Purpose |
|----------|----------|----------|
| `XAI_API_KEY` | Preferred for agent | xAI Chat Completions (`https://api.x.ai/v1`) |
| `OPENAI_API_KEY` | Alt | OpenAI-compatible Chat Completions |
| `GROK_API_KEY` | Alt | Treated like xAI if `XAI_API_KEY` unset |
| `TAVILY_API_KEY` | Optional | Enables `web_search` via `https://api.tavily.com/search` |
| `AVRONE_SHELL_ENABLED` | Optional | `1` only on trusted hosts — **leave unset/0 on Vercel** |
| `AVRONE_SANDBOX_DIR` | Optional | Sandbox cwd (default `<cwd>/.avrone-sandbox`) |

**Resolution order:** `XAI_API_KEY` → `OPENAI_API_KEY` → `GROK_API_KEY`.

**Tools:** `web_search`, `web_fetch`, `sandbox_js` (node:vm), `sandbox_shell` (allowlisted; disabled on Vercel by default).

**Without LLM keys:** lattice echo remains; explicit intents still work: `search <q>`, `fetch <url>`, `js: <code>`, `shell: <cmd>`.

### Vercel project env (production)

Project: **avrone-due-krey-chat** (`prj_rA7ACxV6Ge8vaciVBWjiYcfSJ9R5`) · Root Directory: `avrone-chat`

1. Vercel → Project → Settings → Environment Variables (Production + Preview as needed)
2. Set at minimum: `XAI_API_KEY` (or `OPENAI_API_KEY`)
3. Optional: `TAVILY_API_KEY` for search
4. Do **not** set `AVRONE_SHELL_ENABLED=1` on Vercel unless you accept host shell risk
5. Keep existing `CONTROL12_*` / `EVIDENCE_CONSOLE_URL` as before
6. Redeploy after saving env

**Jean action:** paste API keys into Vercel (never commit). Agent mode stays echo-only until keys exist.

### Local agent verify

```bash
cd avrone-chat
cp .env.example .env.local
# set XAI_API_KEY and optional TAVILY_API_KEY
npm install
npm test
npm run typecheck
npm run build
npm run dev
# try: "search living intermediate control plane" or "js: return 2+2"
```

UI reads `x-avrone-tools` (JSON summary) and SSE comment events `: avrone-tool …` for status text.

## Skills (Grok Bot)

- [Claim ChatGPT Plus free trial](sand-workflow:claim-chatgpt-plus-free-trial) — optional, skipped for Avrone finish
- [Review GitHub PR before merge](sand-workflow:review-github-pr-before-merge) — Actions → Files changed → confirm before merge
