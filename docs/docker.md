# Docker

## Build

```bash
docker build -t living-intermediate-control-plane:0.3.2 .
```

Or:

```bash
npm run docker:build
```

## Run doctor

```bash
docker run --rm living-intermediate-control-plane:0.3.2
```

## Run other commands

```bash
docker run --rm living-intermediate-control-plane:0.3.2 node status/health.mjs
docker run --rm living-intermediate-control-plane:0.3.2 node test/self-test.mjs
docker run --rm living-intermediate-control-plane:0.3.2 node status/ci-check.mjs
```

## Persist local data (optional)

```bash
docker run --rm -v "$(pwd)/data:/app/data" living-intermediate-control-plane:0.3.2 node integrate.mjs procure
```

## CI

The GitHub Actions workflow includes a Docker build step after the Node checks pass.
