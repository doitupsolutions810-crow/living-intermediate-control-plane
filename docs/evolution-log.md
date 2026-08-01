# Evolution Log

## 2026-08-01 — Kaniko cache, Syft SBOM, OPA policy (0.3.7)

- Kaniko: `--cache`, `--cache-dir`, `--cache-ttl`, `--compressed-caching`, optional `--cache-repo`
- Kaniko layer cache persisted with `actions/cache`
- Syft SBOM (SPDX + CycloneDX) for Kaniko images, uploaded as artifacts
- OPA/Conftest policy on Trivy JSON (`policy/trivy-results.rego`) for Buildx and Kaniko paths
- Docs: `docs/kaniko.md`, updated `docs/trivy.md` and `docs/ci.md`

## 0.3.6

- trivy.yaml, .trivyignore example, Kaniko job introduced

## 0.3.5

- Distroless runtime, Trivy FS/image, Buildx GHA cache
