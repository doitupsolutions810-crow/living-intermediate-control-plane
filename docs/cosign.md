# Sigstore Cosign + Rekor

## Learn keyless signing (GitHub OIDC)

Full guide: **`docs/oidc-cosign-keyless.md`**

Short version:

1. CI has `permissions: id-token: write`  
2. Cosign signs the **registry digest** without a stored private key  
3. Fulcio binds a short-lived cert to the GitHub workflow identity  
4. Rekor records the signature  
5. `cosign verify` checks cert + log  

Production path in this repo: **GHCR push on main + hard Cosign verify** (`docs/ci-registry-cosign.md`).

## Install Cosign

https://docs.sigstore.dev/cosign/system_config/installation/

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

### Plane

```bash
plane rekor version
npm run rekor -- search --sha <hex>
```

## Local Cosign helpers

```bash
IMAGE_REF=living-intermediate-control-plane:0.9.1 npm run cosign:sign
IMAGE_REF=living-intermediate-control-plane:0.9.1 npm run cosign:verify
```

Prefer CI keyless on a **pushed** digest for production trust.

## Operator host

```bash
npm run operator-host
```

See `docs/operator-host-setup.md` and `docs/next-ops.md`.
