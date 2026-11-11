# Control704 access layer — IT Technician auth, X/Y/Z proxy, dataset code override

Lives in `avrone-chat/` (Avrone Due’Krey, Vercel project `avrone-due-krey-chat`).
It replaces the stub in `control704-proxy-system/src/proxy.js` (which granted
access to any caller claiming `VIP`/`moderator`) with real authentication.

## Architecture

```
Technician ──► /control704/login ──► POST /api/control704/login
                                       │ scrypt-verify id + access key (CONTROL704_ACCOUNTS)
                                       ▼
                         c704_session cookie (HMAC-SHA256, AVRONE_AUTH_SECRET,
                         HttpOnly · Secure · SameSite=Strict · 8h)
                                       │
       ┌──────────────── middleware.ts (Edge) ─────────────────┐
       │ verifies signature/expiry on /control704/*, /api/control704/*, /api/proxy/*
       │ blocks cross-origin POST/PUT/PATCH/DELETE (CSRF)
       └────────────────────────────────────────────────────────┘
                                       │ route handlers re-verify + re-check account (guard.ts)
            ┌──────────────────────────┼──────────────────────────────┐
            ▼                          ▼                              ▼
  /api/proxy/{x|y|z}/<path>   /api/control704/override        /api/chat (LangGraph)
  lib/control704/proxy.ts     lib/control704/override.ts      tools proxy_x/y/z, control704_targets,
  fixed upstream per target   admin-only break-glass          dataset_override (only with a session)
            │                          │
            └──────────► lib/control704/audit.ts (append-only, hash-chained JSONL + stdout)
```

| File | Role |
|------|------|
| `middleware.ts` | Edge gate: 401 for APIs, redirect to login for pages, CSRF origin check |
| `lib/control704/session.ts` | Sign/verify session tokens (Web Crypto HMAC) |
| `lib/control704/accounts.ts` | `CONTROL704_ACCOUNTS` loader, scrypt hashing/verification |
| `lib/control704/guard.ts` | `requireRole`, session re-check + role downgrade |
| `lib/control704/targets.ts` | X/Y/Z definitions + per-role policy from env |
| `lib/control704/proxy.ts` | Safe proxy core (shared by route + agent tools) |
| `lib/control704/override.ts` | Dataset override: validate → dry-run diff → apply/revert |
| `lib/control704/audit.ts` | Append-only audit log |
| `lib/control704/agent-tools.ts` | LangGraph tools |
| `app/control704/*` | UI: login, dashboard, override |

## Roles

| Role | Dashboard / audit | Proxy (default methods) | Override |
|------|-------------------|-------------------------|----------|
| `viewer` | yes | GET, HEAD | no |
| `technician` | yes, + dataset view | GET, HEAD, POST | no (read only) |
| `admin` | yes | GET, HEAD, POST, PUT, PATCH, DELETE | preview, apply (confirm), revert |

If an account is removed or downgraded in `CONTROL704_ACCOUNTS`, existing
cookies lose that access on the next request (role = min(cookie, account)).

## X, Y, Z

Names and auth modes come from the existing `control704-proxy-system` repo:

| Target | Default label | Auth mode (from proxy.js) | Route |
|--------|---------------|---------------------------|-------|
| X | `X · token-override` | token-override | `/api/proxy/x/...` |
| Y | `Y · dataset-code` | dataset-code | `/api/proxy/y/...` |
| Z | `Z · lattice-op` | lattice-op | `/api/proxy/z/...` |

No upstream hosts were defined anywhere, so **all three are placeholders until
you set a URL**; unconfigured targets return `503 target_not_configured` and show
"not configured" on the dashboard. Rename any target with `CONTROL704_PROXY_<T>_LABEL`.
(Z is the natural home for the Control12 lattice-op API — set
`CONTROL704_PROXY_Z_URL` to it if that's the intent; it is not wired automatically.)

### Wiring to control704-proxy-system (per-technician JWT)

`control704-proxy-system` verifies Avrone Due'Krey JWTs (`AVRONE_ISSUER`, `AVRONE_AUDIENCE`,
`AVRONE_JWT_SECRET`). Point a target at it and set `CONTROL704_PROXY_<T>_TOKEN_MODE=avrone-jwt`:
for every proxied call, `lib/control704/avrone-jwt.ts` mints an HS256 token with
`iss`/`aud` from env, `sub` = technician id, `roles` = [session role], `exp` = now + 120 s
(30–300 via `CONTROL704_PROXY_JWT_TTL_S`) and a random `jti`. The static `_TOKEN` is not sent in
this mode. Missing or weak config fails closed with `503 proxy_jwt_not_configured`.
`test/control704-avrone-jwt.test.mjs` checks the contract with a reference verifier and, when
`CONTROL704_PROXY_SYSTEM_DIR` points at a proxy checkout, with the proxy's own verifier.

### Proxy safety

- Upstream host is fixed per target from env (https only; no credentials in URL).
  Callers supply only path + query; `..`, encoded slashes, empty segments, `#`, whitespace are rejected
  and the final URL is re-checked against the base origin/path (no SSRF).
- Caller `Authorization`/`Cookie` headers are never forwarded; the upstream credential
  (`CONTROL704_PROXY_<T>_TOKEN`) is injected server-side. Upstream `Set-Cookie`/`Location` are dropped.
- Redirects not followed (3xx → 502). Request ≤ 256 KB, response ≤ 2 MB, 15 s timeout.
- Rate limit per technician per target (default 60/min, `CONTROL704_PROXY_RATE_PER_MIN`; per instance).
- Every allowed or denied call is audited (`proxy.x|y|z`).

## Dataset code override (break-glass)

`POST /api/control704/override` (admin only):

```jsonc
// 1. preview (default) — returns {diff:{before,after,expiresAt}}, nothing changes
{"dataset":"x","key":"code","value":"ABC123","reason":"incident 42: unblock lattice","ttlMinutes":60}
// 2. apply
{ ...same, "dryRun": false, "confirm": true }
// revert
{"op":"revert","id":"<override id>","reason":"incident resolved"}
```

- Reason 10–500 chars required; optional expiry (`ttlMinutes` or ISO `expiresAt`, max 30 days).
- Keys are dotted `[A-Za-z0-9_-]` paths (no `__proto__`/`constructor`), value is JSON ≤ 16 KB.
- Datasets come from `CONTROL704_DATASETS` (JSON object). Default: empty `x`, `y`, `z`.
- The override endpoint cannot create sessions, change roles, or touch accounts — it sits behind the same auth.
- Previews, applies, denials and reverts are all audited with who/when/what/reason.

## Audit log

Append-only, hash-chained (`hash = sha256(prevHash + entry)`), with no update/delete API.
Written to `CONTROL704_AUDIT_PATH` (default `/tmp/control704-audit.jsonl`) and mirrored to
stdout as `[control704-audit] {...}` → **Vercel runtime logs are the durable copy** (serverless
`/tmp` is per instance and lost on cold start). Dashboard shows the recent entries on the
serving instance plus chain verification.

## Agent tools (Avrone chat, LangGraph)

Attached only when the chat request carries a valid `c704_session` cookie:

- `proxy_x`, `proxy_y`, `proxy_z` — same policy/audit as the HTTP proxy, as the signed-in technician.
- `control704_targets` — target status + your access.
- `dataset_override` — admin only; dry run by default; apply requires `dry_run=false` **and** `confirm=true`
  (the model is instructed to confirm with you first).

## Env vars

| Variable | Required | Purpose |
|----------|----------|---------|
| `AVRONE_AUTH_SECRET` | yes | ≥ 32 chars, HMAC key for sessions (sensitive). Missing → login 503, everything 401 |
| `CONTROL704_ACCOUNTS` | yes | JSON array `[{"id","role","keyHash"}]` — hashes only (sensitive) |
| `CONTROL704_SESSION_TTL_S` | no | Session lifetime, 300–604800 (default 28800) |
| `CONTROL704_PROXY_{X,Y,Z}_URL` | per target | Fixed https upstream base |
| `CONTROL704_PROXY_{X,Y,Z}_TOKEN` | no | Upstream credential, injected server-side (sensitive) |
| `CONTROL704_PROXY_{X,Y,Z}_AUTH_HEADER` | no | Header for token (default `authorization` → `Bearer <token>`) |
| `CONTROL704_PROXY_{X,Y,Z}_LABEL` | no | Display name |
| `CONTROL704_PROXY_{X,Y,Z}_PATHS` | no | Comma list of allowed path prefixes (default `/`) |
| `CONTROL704_PROXY_{X,Y,Z}_POLICY` | no | Per-role JSON `{"viewer":{"methods":["GET"],"paths":["/status"]},...}` |
| `CONTROL704_PROXY_RATE_PER_MIN` | no | Default 60 |
| `CONTROL704_PROXY_ALLOW_HTTP` | no | `1` allows http upstreams (local dev only) |
| `CONTROL704_DATASETS` | no | Base datasets JSON object |
| `CONTROL704_AUDIT_PATH` / `CONTROL704_OVERRIDE_PATH` | no | File locations (default `/tmp`) |

## Add a technician

```bash
cd avrone-chat
# prints the updated CONTROL704_ACCOUNTS JSON (hashes only); key goes to the file, mode 600
node scripts/control704-hash-key.mjs alex technician --key-out ./alex.key \
  --merge "$CURRENT_CONTROL704_ACCOUNTS_JSON"
```

Paste the printed JSON into Vercel env `CONTROL704_ACCOUNTS` (sensitive), redeploy, and send
the key to the technician privately. Revoke: remove the entry (or `"disabled": true`) and redeploy.
Rotate everyone's sessions: change `AVRONE_AUTH_SECRET` and redeploy.
