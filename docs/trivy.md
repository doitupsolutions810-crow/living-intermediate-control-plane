# Trivy + Snyk + OPA integration

## Local

```bash
npm run security-scan
IMAGE_REF=living-intermediate-control-plane:0.4.4 npm run security-scan
```

1. Trivy FS/image → `data/trivy-report.json` → Conftest (`policy/trivy-results.rego` + suite)  
2. Snyk test/container → `data/snyk-*.json` → Conftest (`policy/snyk-results.rego`)  

## Snyk Rego (active)

`policy/snyk-results.rego` denies:

- critical / high vulnerabilities  
- denied package name patterns  

```bash
conftest test --policy policy/snyk-results.rego data/snyk-test.json
```

## Gatekeeper

Kubernetes admission policies: `docs/gatekeeper.md` and `k8s/gatekeeper/`.
