# Sigstore Cosign + Rekor transparency log

## Cosign commands

```bash
npm run docker:build

IMAGE_REF=living-intermediate-control-plane:0.4.8 npm run cosign:sign
IMAGE_REF=living-intermediate-control-plane:0.4.8 npm run cosign:verify
```

Sign uploads to **Rekor** by default (`--tlog-upload=true`).

Disable upload if needed:

```bash
REKOR_UPLOAD=0 IMAGE_REF=... npm run cosign:sign
```

Custom Rekor server:

```bash
REKOR_SERVER_URL=https://rekor.sigstore.dev IMAGE_REF=... npm run cosign:sign
```

## Rekor transparency log

Public log: `https://rekor.sigstore.dev`

| Command | Purpose |
|---------|--------|
| `npm run cosign:sign` | Sign image and upload entry to Rekor |
| `npm run cosign:verify` | Verify signature (includes Rekor check when applicable) |
| `npm run rekor:search` | Search log by artifact hash |
| `npm run rekor:get` | Fetch entry by UUID |

```bash
REKOR_ARTIFACT_HASH=sha256:... npm run rekor:search
REKOR_UUID=... npm run rekor:get
```

Requires `rekor-cli` for search/get. Cosign verify alone is enough for most CI checks.

## Modes

| Mode | Notes |
|------|--------|
| Keyless + Rekor | Best in GitHub Actions (`id-token: write`) on a **pushed** image digest |
| Key pair + Rekor | Local keys; still uploads to Rekor unless `REKOR_UPLOAD=0` |

## Why Rekor

- Append-only public log of signing events  
- Independent verification that a signature existed at a point in time  
- Works with Cosign keyless and key-based flows  
