# Docker

## Build options

### A. Docker Buildx (default CI path)

```bash
docker build -t living-intermediate-control-plane:0.3.6 .
# or
npm run docker:build
```

CI uses Buildx with GitHub Actions layer cache (`type=gha,mode=max`).

### B. Kaniko (alternative — no Docker daemon required)

Useful in Kubernetes CI or locked-down runners where Docker-in-Docker is unavailable.

CI job: `kaniko-build` in `.github/workflows/plane-ci.yml`

Local-style example (executor container writing a tar):

```bash
mkdir -p /tmp/kaniko-out
docker run --rm \
  -v "$PWD:/workspace" \
  -v "/tmp/kaniko-out:/out" \
  gcr.io/kaniko-project/executor:v1.23.2-debug \
  --dockerfile=/workspace/Dockerfile \
  --context=dir:///workspace \
  --no-push \
  --tarPath=/out/plane.tar \
  --destination=living-intermediate-control-plane:kaniko \
  --verbosity=info

docker load -i /tmp/kaniko-out/plane.tar
```

Both paths produce an image from the same `Dockerfile` and are scanned with Trivy.

## Image design

| Stage | Base | Role |
|-------|------|------|
| `prepare` | `node:20-bookworm-slim` | Copy source, init data, ownership |
| `runtime` | `gcr.io/distroless/nodejs20-debian12:nonroot` | Minimal final image |

### Layer caching strategy

1. Metadata first (`package.json`, `config.json`)
2. Source by area for partial cache hits
3. Init only in prepare stage
4. CI Buildx cache: `cache-from/to: type=gha,mode=max`
5. No npm install layer

### Distroless runtime

- No shell, no package manager
- uid `65532` (`nonroot`)
- Entrypoint is `node`; pass the script path as the command

## Security scanning

See `docs/trivy.md` for config and ignore-file rules.

| Scan | When |
|------|------|
| Trivy FS | After Node checks |
| Trivy image | After Buildx build |
| Trivy image | After Kaniko build (best-effort) |

## Run

```bash
docker run --rm living-intermediate-control-plane:0.3.6
docker run --rm living-intermediate-control-plane:0.3.6 status/health.mjs
```
