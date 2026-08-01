# Living Intermediate Control Plane

Version **0.4.9**

## CLI

```bash
node bin/plane.mjs checklist
node bin/plane.mjs procure
plane rekor version
```

## Cosign + Rekor

```bash
# Install rekor-cli (optional for log queries)
brew install rekor-cli

IMAGE_REF=living-intermediate-control-plane:0.4.9 npm run cosign:sign
IMAGE_REF=living-intermediate-control-plane:0.4.9 npm run cosign:verify

npm run rekor -- version
npm run rekor -- search --sha <hex>
npm run rekor -- get --uuid <uuid>
```

See `docs/cosign.md` and `docs/cli.md`.
