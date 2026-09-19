# CI integration

## plane-checks

upgrade-check → verify-changes → doctor → test → health → checklist → dry-run → Trivy FS → optional Snyk open-source

## docker-build

1. Buildx build + load  
2. Doctor in image  
3. Cosign (best-effort on PRs; hard when registry push)  
4. Trivy image + OPA  
5. **Snyk container scan** (requires `SNYK_TOKEN`)  
6. SARIF upload  

## Optional Actions Snyk

Set repo secret `SNYK_TOKEN` to enable hard Snyk gates in Actions. If unset, those steps skip with a clear log (Trivy + OPA still enforce). Do not invent or commit the token.

Workflow note: GitHub forbids `secrets.*` inside step `if:` expressions. This workflow maps `SNYK_TOKEN` to job `env` and gates with `env.SNYK_TOKEN`.

## Local

```bash
npm run ci
IMAGE_REF=living-intermediate-control-plane:0.5.6 npm run security-scan
```

Snyk container details: `docs/snyk-container.md`
