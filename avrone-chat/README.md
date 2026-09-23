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

When any LLM provider is configured (paid keys, free-tier keys, or keyless Pollinations), `POST /api/chat` prefers the agent tool loop. Paid keys still win when credited.

Legacy note: When `XAI_API_KEY` (preferred), `OPENAI_API_KEY`, or `GROK_API_KEY` is set, `POST /api/chat` runs a multi-step tool loop (search / fetch / JS sandbox / allowlisted shell) and streams the final answer as SSE.

If every provider is disabled (no keys and Pollinations off), chat keeps the lattice echo and still accepts explicit tool intents: `search …`, `fetch https://…`, `js: …`, `shell: …`.

```bash
npm test
```

## Free / open-source LLM fallbacks

When paid keys (OpenAI / xAI / Grok) hit credit or auth errors (401/402/403/429), Avrone walks a longer provider chain:

1. **Paid** — `openai`, `xai`, `grok` (when keys are set)
2. **Keyed free tiers** — OpenRouter free models, Groq, Mistral, Gemini, NVIDIA, Cerebras, Hugging Face (only when their env key is present)
3. **Self-host** — `AVRONE_COMPATIBLE_BASE_URL` (Ollama / vLLM)
4. **Keyless** — [Pollinations](https://text.pollinations.ai) (`openai-fast`), enabled unless `AVRONE_POLLINATIONS_ENABLED=0`

OpenRouter expands `OPENROUTER_FREE_MODELS` (comma-separated) into separate tries. Groq always tries a second OSS model (`openai/gpt-oss-20b`) when its key is set. Keyless configs omit the `Authorization` header. See `.env.example` for the full list.

`AVRONE_LLM_PREFER=<provider>` still moves one named provider to the front when it matches.

See `docs/avrone-operator-kb.md` for Vercel env wiring (`avrone-due-krey-chat`).
