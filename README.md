# Living Intermediate Control Plane

Version **0.4.8**

## CLI

```bash
node bin/plane.mjs checklist
node bin/plane.mjs procure
node bin/plane.mjs doctor
```

## Cosign + Rekor

```bash
IMAGE_REF=living-intermediate-control-plane:0.4.8 npm run cosign:sign
IMAGE_REF=living-intermediate-control-plane:0.4.8 npm run cosign:verify
REKOR_ARTIFACT_HASH=sha256:... npm run rekor:search
```

Signatures are recorded in the Rekor transparency log by default.

See `docs/cli.md` and `docs/cosign.md`.

## Success criteria

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement stays active  
