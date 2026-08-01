# Docker

## Build

```bash
docker build -t living-intermediate-control-plane:0.3.4 .
```

Or:

```bash
npm run docker:build
```

## Layer design

1. **Metadata** — `package.json`, `config.json` (changes rarely)
2. **Source by area** — `lib`, `lattice`, `agents`, `status`, etc. (cache-friendly)
3. **Init + ownership** — create `data/`, run init, set `node` user
4. **Runtime stage** — copy only the prepared tree, run as non-root

No `npm install` is performed: the plane has no production dependencies.

## Run doctor

```bash
docker run --rm living-intermediate-control-plane:0.3.4
```

## Run other commands

```bash
docker run --rm living-intermediate-control-plane:0.3.4 node status/health.mjs
docker run --rm living-intermediate-control-plane:0.3.4 node test/self-test.mjs
docker run --rm living-intermediate-control-plane:0.3.4 node status/ci-check.mjs
```

## Persist local data (optional)

```bash
docker run --rm -v "$(pwd)/data:/app/data" living-intermediate-control-plane:0.3.4 \
  node integrate.mjs procure
```

## CI

The GitHub Actions workflow builds this image after Node checks pass, then runs doctor inside it.
