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



## LangGraph agent + operator training

When `AVRONE_LANGGRAPH_ENABLED` is unset or truthy (default **on**), `POST /api/chat` runs a LangGraph `StateGraph` loop (`llmCall` ↔ tools) via `@langchain/langgraph` + `ChatOpenAI`. Response headers include `x-avrone-engine: langgraph` and `x-avrone-agent: langgraph`. On graph errors or when the flag is `0`/`false`/`off`, Avrone falls back to the classic `runAgentLoop` (`x-avrone-engine: classic`).

Existing tools (`web_search`, `web_fetch`, `sandbox_js`, `sandbox_shell`) are wrapped as LangChain `tool()`s that call into `executeTool` — sandbox/research libs are not rewritten. Multi-provider fallbacks (`listLlmConfigs` / `isRetryableLlmFailure`) still apply.

### Operator training (prompt-memory, not weight training)

`remember_lesson` stores short durable preferences/facts (max ~20 recent strings). Lessons are injected into the system prompt as **Trained operator notes**. Persistence:

- In-process cache (warm instances)
- Optional env blob `AVRONE_OPERATOR_MEMORY` (JSON array) — preferred on Vercel
- Optional file `AVRONE_OPERATOR_MEMORY_PATH` (default `/tmp/...`, best-effort; cold starts may reset)

This is **prompt-memory training for the operator**, not ML fine-tuning of model weights. LangSmith tracing is optional later.

## Free / open-source LLM fallbacks

When paid keys (OpenAI / xAI / Grok) hit credit or auth errors (401/402/403/429), Avrone walks a longer provider chain:

1. **Paid** — `openai`, `xai`, `grok` (when keys are set)
2. **Keyed free tiers** — OpenRouter free models, Groq, Mistral, Gemini, NVIDIA, Cerebras, Hugging Face (only when their env key is present)
3. **Self-host** — `AVRONE_COMPATIBLE_BASE_URL` (Ollama / vLLM)
4. **Keyless** — [Pollinations](https://text.pollinations.ai) (`openai-fast`), enabled unless `AVRONE_POLLINATIONS_ENABLED=0`

OpenRouter expands `OPENROUTER_FREE_MODELS` (comma-separated) into separate tries. Groq always tries a second OSS model (`openai/gpt-oss-20b`) when its key is set. Keyless configs omit the `Authorization` header. See `.env.example` for the full list.

`AVRONE_LLM_PREFER=<provider>` still moves one named provider to the front when it matches.

See `docs/avrone-operator-kb.md` for Vercel env wiring (`avrone-due-krey-chat`).
