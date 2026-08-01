# Integrated supply chain

One operator path for scan → policy → sign/verify posture.

## Command

```bash
plane supply-chain
npm run supply-chain

# With image (container scans + optional sign)
npm run docker:build
IMAGE_REF=living-intermediate-control-plane:0.8.1 plane supply-chain

# Sign + verify (Cosign / Rekor)
SUPPLY_CHAIN_SIGN=1 IMAGE_REF=living-intermediate-control-plane:0.8.1 plane supply-chain
```

## What runs

1. **security-scan** — Trivy (FS + image) + Snyk (app + container) + OPA  
2. **cosign sign** — only if `SUPPLY_CHAIN_SIGN=1` and `IMAGE_REF` set  
3. **cosign verify** — when `IMAGE_REF` set (hard fail if sign was requested)  
4. **security-summary** — posture overview  

Result: `data/supply-chain-last.json`

## Stack

| Layer | Tool |
|-------|------|
| Scan | Trivy + Snyk |
| Policy | OPA/Conftest |
| Runtime image | Distroless non-root |
| Sign | Cosign |
| Transparency log | Rekor |
| SBOM / provenance | Syft + SLSA-style (CI) |

## CI

GitHub Actions `plane-ci.yml` already runs Trivy, OPA, optional Snyk container, Cosign (best-effort), SLSA artifacts on the docker-build job.

## Admission

Supply-chain success does not replace plane admission:

```bash
plane supply-chain
plane admit-change
plane unattended
```
