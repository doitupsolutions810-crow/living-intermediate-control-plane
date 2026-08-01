# Living Intermediate Control Plane

Version **0.4.0**

Local control plane for readiness, five-role checks, operator actions, and supply-chain-aware CI.

## Quick start

```bash
npm run init
npm run procure
npm run doctor
npm run security-summary
npm run help
```

## Success criteria (only three)

1. Readiness is READY  
2. Evidence is available (public console or local plane accepted)  
3. Supply-chain enforcement stays active  

## Common commands

```bash
npm run procure
npm run dry-run
npm run doctor
npm run security-summary
npm run ci
npm run docker:build
npm run docker:doctor
npm run report
npm run pause
npm run resume
npm test
```

## Supply chain (summary)

- Distroless non-root image  
- Trivy FS + image scans  
- OPA/Conftest policy on scan results  
- Syft SBOM (Kaniko path)  
- SLSA-style provenance documents  
- Buildx (default) and Kaniko (daemon-free) builds  

See `docs/security.md`.

## Documents

- `docs/operator-summary.md`
- `docs/security.md`
- `docs/ci.md`
- `docs/docker.md`
- `docs/examples.md`

## Note

CI is a helper. Readiness and doctor remain the authority for limited-technicality procurement decisions.
