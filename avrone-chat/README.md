# Avrone Chat (ship-ready)

Next.js UI + API proxies for the Living Intermediate Control Plane.

## Local

```bash
cp .env.example .env.local
# set CONTROL12_PLATFORM_URL (and optional CONTROL12_PLATFORM_TOKEN)
npm install
npm run dev
```

Optional checks:

```bash
npm run typecheck
npm run build
```

## Vercel

1. Import this repo (or set Root Directory to `avrone-chat`).
2. Add env vars from `.env.example` (no secrets in git).
3. Deploy. `vercel.json` pins Next.js build defaults.

## API routes

| Route | Purpose |
|-------|---------|
| `GET /api/cockpit` | Platform health + anomalies + graceful evidence-console probe |
| `POST /api/chat` | Lattice-wired chat (SSE-shaped stream) |
| `GET /api/health` | Liveness for deploy probes |

When `EVIDENCE_CONSOLE_URL` is unset or the public domain returns 404/unreachable, cockpit reports local plane authority instead of failing hard.

## Agent tools

When `XAI_API_KEY` (preferred), `OPENAI_API_KEY`, or `GROK_API_KEY` is set, `POST /api/chat` runs a multi-step tool loop (search / fetch / JS sandbox / allowlisted shell) and streams the final answer as SSE.

Without keys, chat keeps the lattice echo and still accepts explicit tool intents: `search …`, `fetch https://…`, `js: …`, `shell: …`.

```bash
npm test
```

See `docs/avrone-operator-kb.md` for Vercel env wiring (`avrone-due-krey-chat`).
