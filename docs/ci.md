# CI integration

## Jobs

### 1. plane-checks
1. Init local data
2. Doctor
3. Self-test
4. Health
5. Smoke
6. Dry-run procure
7. **Trivy FS scan** (CRITICAL/HIGH)

### 2. docker-build (after plane-checks)
1. Buildx build with **GHA layer cache** (`mode=max`)
2. Run doctor inside the image
3. **Trivy image scan** (CRITICAL/HIGH)
4. SARIF upload (best-effort)

Local equivalents:

```bash
npm run ci
npm run docker:build
npm run docker:doctor
```

Workflow: `.github/workflows/plane-ci.yml`

## Layer caching (CI)

- `docker/setup-buildx-action`
- `cache-from: type=gha`
- `cache-to: type=gha,mode=max` — caches all intermediate layers, not only the final image

Rebuilds on unchanged source should reuse prepare/runtime layers.

## Security scanning

| Step | Scope | Fail on |
|------|--------|--------|
| Trivy FS | Repository files | CRITICAL, HIGH |
| Trivy image | Built container | CRITICAL, HIGH |

`ignore-unfixed: true` avoids failing on issues with no upstream fix yet.

## Account-level caveat (Issue #3)

Some runs may still fail with `startup_failure` before any job starts. Run locally instead:

```bash
npm run ci
npm run docker:build
```

## Design rule

CI is a helper, not the source of truth. Readiness and doctor remain authoritative for limited-technicality procurement decisions.
