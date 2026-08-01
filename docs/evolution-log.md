# Evolution Log

## 2026-08-01 — Distroless + security scanning (0.3.5)

- Runtime image switched to `gcr.io/distroless/nodejs20-debian12:nonroot`
- Trivy FS scan in plane-checks job
- Trivy image scan + SARIF upload in docker-build job
- Buildx GHA cache with `mode=max` documented and applied
- Prepare stage moved to `node:20-bookworm-slim` for glibc compatibility with distroless

## 0.3.4

- Multi-stage Alpine optimization, non-root user, tighter dockerignore

## 0.3.3

- Initial Dockerfile + CI Docker build job
