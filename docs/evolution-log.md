# Evolution Log

## 2026-08-01 — Example Rego, SLSA provenance, Kaniko cache keys (0.3.8)

- Example Rego policies under `policy/examples/`
- SLSA-style provenance JSON for Buildx and Kaniko; GitHub attestations (best-effort)
- Buildx `provenance: mode=max` and `sbom: true`
- Optimized Kaniko cache keys with layered restore-keys
- Docs: `docs/slsa.md`, updated kaniko/trivy/policy docs

## 0.3.7

- Kaniko cache flags, Syft SBOM, OPA on Trivy JSON
