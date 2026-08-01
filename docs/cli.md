# Concrete CLI commands

```bash
node bin/plane.mjs help
node bin/plane.mjs checklist
node bin/plane.mjs procure
npm run plane -- doctor
```

## Cosign / Rekor

Install **Cosign** for sign/verify.  
Install **rekor-cli** only if you need log search/get (see `docs/cosign.md`).

```bash
IMAGE_REF=living-intermediate-control-plane:0.4.8 plane cosign-sign
IMAGE_REF=living-intermediate-control-plane:0.4.8 plane cosign-verify
REKOR_ARTIFACT_HASH=sha256:... npm run rekor:search
```
