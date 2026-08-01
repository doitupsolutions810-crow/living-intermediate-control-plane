# Kaniko build alternative

Kaniko builds the same `Dockerfile` without a Docker daemon. Used in CI job `kaniko-build`.

## Cache configuration

| Flag | Value in CI | Purpose |
|------|-------------|--------|
| `--cache` | `true` | Enable layer caching |
| `--cache-dir` | `/cache` | Local cache directory inside the executor |
| `--cache-ttl` | `2160h` (~90 days) | Max age of cached layers |
| `--compressed-caching` | on | Smaller on-disk cache |
| `--cache-repo` | optional | Remote cache repository |

### Local cache (default)

CI mounts `/tmp/kaniko-cache` → `/cache` and persists it with `actions/cache`:

- **Key** includes hashes of `Dockerfile`, `package.json`, `config.json`, and main source trees
- **restore-keys** fall back to the latest OS-level Kaniko cache

### Remote cache (optional)

Set repository secret **`KANIKO_CACHE_REPO`** to a writable image reference, for example:

```text
ghcr.io/<org>/living-intermediate-control-plane/kaniko-cache
```

When set, Kaniko also uses `--cache-repo` so layers can be shared across runners.

## SBOM (Syft)

After a successful Kaniko build, Syft generates:

| Format | Artifact |
|--------|----------|
| SPDX JSON | `sbom-kaniko.spdx.json` |
| CycloneDX JSON | `sbom-kaniko.cdx.json` |

Both are uploaded as workflow artifacts.

## Policy

Trivy JSON for the Kaniko image is checked with Conftest/OPA (`policy/trivy-results.rego`).

## Local sketch

```bash
mkdir -p /tmp/kaniko-out /tmp/kaniko-cache

docker run --rm \
  -v "$PWD:/workspace" \
  -v "/tmp/kaniko-out:/out" \
  -v "/tmp/kaniko-cache:/cache" \
  gcr.io/kaniko-project/executor:v1.23.2-debug \
  --dockerfile=/workspace/Dockerfile \
  --context=dir:///workspace \
  --no-push \
  --tarPath=/out/plane.tar \
  --destination=living-intermediate-control-plane:kaniko \
  --cache=true \
  --cache-dir=/cache \
  --cache-ttl=2160h \
  --compressed-caching \
  --verbosity=info

docker load -i /tmp/kaniko-out/plane.tar
```
