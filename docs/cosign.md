# Sigstore Cosign + Rekor

## Install rekor-cli

### Homebrew

```bash
brew install rekor-cli
rekor-cli version
```

### Linux amd64

```bash
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-linux-amd64
chmod +x rekor-cli && sudo mv rekor-cli /usr/local/bin/rekor-cli
rekor-cli version
```

### Linux arm64

```bash
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-linux-arm64
chmod +x rekor-cli && sudo mv rekor-cli /usr/local/bin/rekor-cli
```

### macOS manual

```bash
# Apple Silicon
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-darwin-arm64
# Intel: rekor-cli-darwin-amd64
chmod +x rekor-cli && sudo mv rekor-cli /usr/local/bin/rekor-cli
```

### Go

```bash
go install github.com/sigstore/rekor/cmd/rekor-cli@latest
```

### Plane

```bash
plane rekor version
npm run rekor -- search --sha <hex>
```

Operator host (timer + cron + rekor): `docs/operator-host-setup.md`

## Cosign sign / verify

```bash
IMAGE_REF=living-intermediate-control-plane:0.5.3 npm run cosign:sign
IMAGE_REF=living-intermediate-control-plane:0.5.3 npm run cosign:verify
```

Rekor upload is on by default (`--tlog-upload=true`).
