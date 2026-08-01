# Security overview

## Local plane

1. Readiness + five roles before important decisions  
2. Optional doctor gate on procure  
3. Checklist, metrics, concrete `plane` CLI  

## Supply chain (0.5.0)

| Layer | Tool |
|-------|------|
| Scan | Trivy + Snyk |
| Policy | OPA/Conftest (Trivy + Snyk JSON) |
| Image | Distroless non-root |
| Sign | Sigstore Cosign |
| Transparency log | Rekor |
| SBOM / provenance | Syft + SLSA-style docs |
| Cluster (optional) | OPA Gatekeeper |

```bash
plane checklist
plane procure
plane security-scan
npm run docker:build
IMAGE_REF=living-intermediate-control-plane:0.5.0 plane cosign-sign
IMAGE_REF=living-intermediate-control-plane:0.5.0 plane cosign-verify
plane rekor version
```

Install rekor-cli: `brew install rekor-cli` (see `docs/cosign.md`).
