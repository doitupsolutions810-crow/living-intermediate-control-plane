# Living Intermediate Control Plane

Version **0.4.2**

## Quick start

```bash
npm run init
npm run next
npm run procure
npm run doctor
npm run security-scan
```

## Trivy + OPA

```bash
npm run security-scan
IMAGE_REF=living-intermediate-control-plane:0.4.2 npm run security-scan
```

Uses `trivy.yaml` and `policy/trivy-results.rego`. See `docs/trivy.md`.

## Success criteria

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement stays active  
