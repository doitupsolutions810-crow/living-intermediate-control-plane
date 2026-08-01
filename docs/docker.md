# Docker

## Build

```bash
docker build -t living-intermediate-control-plane:0.3.5 .
```

Or:

```bash
npm run docker:build
```

## Image design

| Stage | Base | Role |
|-------|------|------|
| `prepare` | `node:20-bookworm-slim` | Copy source, init data, fix ownership |
| `runtime` | `gcr.io/distroless/nodejs20-debian12:nonroot` | Minimal final image (no shell, no package manager) |

### Layer caching strategy

1. **Metadata first** — `package.json` + `config.json` in their own layer (rarely change).
2. **Source by area** — `lib/`, `lattice/`, `agents/`, `status/`, etc. copied separately so a change in one area does not bust unrelated layers.
3. **Init in prepare only** — runtime stage is a pure copy; it stays cacheable and thin.
4. **CI cache** — Buildx `cache-from/to: type=gha,mode=max` stores intermediate layers across GitHub Actions runs.
5. **No npm install** — zero production dependencies, so no lockfile/install layer churn.

### Distroless runtime

- No shell, no `apt`, no package manager
- Runs as uid `65532` (`nonroot`)
- Entrypoint is `node`; `CMD` is the script path only

## Security scanning (CI)

| Scan | Tool | When |
|------|------|------|
| Filesystem / repo | Trivy `fs` | After Node checks |
| Built image | Trivy `image` | After Docker build |
| SARIF upload | Trivy → Code Scanning | Best-effort after image scan |

Severity gate: **CRITICAL** and **HIGH** fail the job. Unfixed issues can be ignored via `ignore-unfixed`.

## Run

```bash
docker run --rm living-intermediate-control-plane:0.3.5

docker run --rm living-intermediate-control-plane:0.3.5 status/health.mjs
docker run --rm living-intermediate-control-plane:0.3.5 test/self-test.mjs
```

Note: distroless has no shell, so do not use `sh -c` or bash entrypoints.

## Persist local data (optional)

```bash
docker run --rm -v "$(pwd)/data:/app/data" living-intermediate-control-plane:0.3.5 \
  integrate.mjs procure
```
