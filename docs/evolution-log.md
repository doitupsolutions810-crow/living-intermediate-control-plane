# Evolution Log

## 2026-08-01 — Trivy config + Kaniko alternative (0.3.6)

- Added `trivy.yaml` (severity, scanners, skip-dirs, ignorefile, timeout)
- Added `.trivyignore` example (comment-only by default)
- Wired `trivy-config: trivy.yaml` into all Trivy CI steps
- Added `kaniko-build` job as Docker-daemon-free alternative to Buildx
- Documented when to use Buildx vs Kaniko (`docs/ci.md`, `docs/docker.md`, `docs/trivy.md`)

## 0.3.5

- Distroless runtime, Trivy FS/image scans, Buildx GHA cache
