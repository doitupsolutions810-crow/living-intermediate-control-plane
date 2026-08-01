# Living Intermediate Control Plane

Version **0.4.7**

## Concrete CLI

```bash
node bin/plane.mjs help
node bin/plane.mjs checklist
node bin/plane.mjs procure
node bin/plane.mjs doctor
node bin/plane.mjs security-scan

# or
npm run plane -- checklist
npm run plane -- procure
```

## Cosign (Sigstore)

```bash
npm run docker:build
IMAGE_REF=living-intermediate-control-plane:0.4.7 npm run cosign:sign
IMAGE_REF=living-intermediate-control-plane:0.4.7 npm run cosign:verify
```

See `docs/cli.md` and `docs/cosign.md`.

## Success criteria

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement stays active  
