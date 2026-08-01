# Living Intermediate Control Plane

Version **0.5.0** — signed supply-chain milestone

## Daily

```bash
plane checklist
plane procure
plane doctor
plane security-scan
```

## Sign + Rekor

```bash
brew install rekor-cli   # optional log queries
npm run docker:build
IMAGE_REF=living-intermediate-control-plane:0.5.0 plane cosign-sign
IMAGE_REF=living-intermediate-control-plane:0.5.0 plane cosign-verify
plane rekor version
```

## Success criteria

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement stays active  

See `docs/cli.md`, `docs/cosign.md`, `docs/security.md`.
