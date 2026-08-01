# Kaniko build alternative

## Optimized cache keys

`actions/cache` key layout (most specific → broadest restore):

```text
kaniko-<os>-df-<Dockerfile hash>-meta-<package+config hash>-src-<source tree hash>
```

**restore-keys** (in order):

1. Same Dockerfile + package/config (any source) — reuse when only app source changed  
2. Same Dockerfile only — reuse when metadata/source changed but Dockerfile did not  
3. OS prefix only — last-resort partial hit  

This matches Dockerfile layer order: metadata and base change less often than `status/` or `integrate.mjs`.

## Cache flags

| Flag | Value | Purpose |
|------|--------|--------|
| `--cache` | `true` | Enable caching |
| `--cache-dir` | `/cache` | Local dir (backed by actions/cache) |
| `--cache-ttl` | `2160h` | ~90 days |
| `--compressed-caching` | on | Smaller disk use |
| `--cache-repo` | secret `KANIKO_CACHE_REPO` | Optional remote cache |

## SBOM + SLSA

- Syft: SPDX + CycloneDX artifacts  
- SLSA-style provenance JSON for the Kaniko image  
- `actions/attest-build-provenance` on SBOM files  

See `docs/slsa.md`.
