# Sigstore Cosign + Rekor transparency log

## Install Cosign

See: https://docs.sigstore.dev/cosign/system_config/installation/

```bash
# Example (GitHub releases) — pick the asset for your OS/arch
# https://github.com/sigstore/cosign/releases
```

## Install rekor-cli

Required for `npm run rekor:search` and `npm run rekor:get`.  
Cosign sign/verify do **not** require rekor-cli (Cosign talks to Rekor itself).

### Linux (amd64)

```bash
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-linux-amd64
chmod +x rekor-cli
sudo mv rekor-cli /usr/local/bin/rekor-cli
rekor-cli version
```

### Linux (arm64)

```bash
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-linux-arm64
chmod +x rekor-cli
sudo mv rekor-cli /usr/local/bin/rekor-cli
rekor-cli version
```

### macOS (amd64)

```bash
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-darwin-amd64
chmod +x rekor-cli
sudo mv rekor-cli /usr/local/bin/rekor-cli
rekor-cli version
```

### macOS (arm64 / Apple Silicon)

```bash
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-darwin-arm64
chmod +x rekor-cli
sudo mv rekor-cli /usr/local/bin/rekor-cli
rekor-cli version
```

### Windows (amd64)

1. Download `rekor-cli-windows-amd64.exe` from  
   https://github.com/sigstore/rekor/releases  
2. Rename to `rekor-cli.exe`  
3. Place it on your `PATH`  
4. Run `rekor-cli version`

### Go install (any OS with Go)

```bash
go install github.com/sigstore/rekor/cmd/rekor-cli@latest
# Ensure $(go env GOPATH)/bin is on PATH
rekor-cli version
```

### Verify install

```bash
rekor-cli version
which rekor-cli
```

If `npm run rekor:search` says rekor-cli is missing, install with one of the methods above or set `ALLOW_SKIP=1` to skip the query step.

---

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

## Rekor transparency log queries

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

## Modes

| Mode | Notes |
|------|--------|
| Keyless + Rekor | Best in GitHub Actions (`id-token: write`) on a **pushed** image digest |
| Key pair + Rekor | Local keys; still uploads to Rekor unless `REKOR_UPLOAD=0` |

## Why Rekor

- Append-only public log of signing events  
- Independent verification that a signature existed at a point in time  
- Works with Cosign keyless and key-based flows  
