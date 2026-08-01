# Sigstore Cosign + Rekor transparency log

## Install Cosign

https://docs.sigstore.dev/cosign/system_config/installation/

---

## Install rekor-cli

Required for integrated Rekor queries (`npm run rekor -- …`).  
Cosign sign/verify talk to Rekor on their own and do **not** require rekor-cli.

### Homebrew (macOS / Linux)

```bash
brew install rekor-cli
rekor-cli version
```

If the formula is named differently in your tap:

```bash
brew search rekor
brew install rekor-cli || brew install rekor
rekor-cli version
```

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

### macOS (manual, without Homebrew)

**Apple Silicon:**
```bash
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-darwin-arm64
chmod +x rekor-cli && sudo mv rekor-cli /usr/local/bin/rekor-cli
```

**Intel:**
```bash
curl -fsSL -o rekor-cli https://github.com/sigstore/rekor/releases/latest/download/rekor-cli-darwin-amd64
chmod +x rekor-cli && sudo mv rekor-cli /usr/local/bin/rekor-cli
```

### Windows (amd64)

1. Download `rekor-cli-windows-amd64.exe` from https://github.com/sigstore/rekor/releases  
2. Rename to `rekor-cli.exe` and add to `PATH`  
3. Run `rekor-cli version`

### Go

```bash
go install github.com/sigstore/rekor/cmd/rekor-cli@latest
rekor-cli version
```

### Verify

```bash
rekor-cli version
which rekor-cli
```

---

## Integrated rekor-cli commands

```bash
# Help
npm run rekor -- help
plane rekor help

# Version
npm run rekor -- version
plane rekor version

# Search by artifact hash
npm run rekor -- search --sha <hex>
REKOR_ARTIFACT_HASH=sha256:abc... npm run rekor -- search
plane rekor search

# Get entry by UUID
npm run rekor -- get --uuid <uuid>
REKOR_UUID=... npm run rekor -- get
plane rekor get

# Pass-through any rekor-cli subcommand
npm run rekor -- search --email user@example.com
```

Default server: `https://rekor.sigstore.dev`  
Override: `REKOR_SERVER_URL=...`

Skip if not installed: `ALLOW_SKIP=1 npm run rekor -- version`

---

## Cosign + Rekor (sign / verify)

```bash
IMAGE_REF=living-intermediate-control-plane:0.4.9 npm run cosign:sign
IMAGE_REF=living-intermediate-control-plane:0.4.9 npm run cosign:verify
```

Sign uses `--tlog-upload=true` by default.  
Disable: `REKOR_UPLOAD=0 IMAGE_REF=... npm run cosign:sign`
