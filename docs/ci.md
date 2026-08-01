# CI integration

## plane-checks

upgrade-check → verify-changes → doctor → test → health → checklist → dry-run → Trivy FS → optional Snyk open-source

## docker-build

1. Buildx build + load  
2. Doctor in image  
3. Cosign (best-effort)  
4. Trivy image + OPA  
5. **Snyk container scan** (requires `SNYK_TOKEN`)  
6. SARIF upload  

## Local

```bash
npm run ci
IMAGE_REF=living-intermediate-control-plane:0.5.6 npm run security-scan
```

Snyk container details: `docs/snyk-container.md`
