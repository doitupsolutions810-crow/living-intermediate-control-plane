# Evolution session — 2026-09-23

## Observed

- Platform process could exit on access-log FS `close` errors (-116) when state lived on a brittle volume.
- Federation publish returned 403 after intentional `code/quorum` smoke because anomaly severity went `high` (`sensitive_route_success`).

## Changes

| Item | Change |
|------|--------|
| `access-logger.mjs` | swallow I/O errors; never crash the plane |
| `server.mjs` | `GET /api/v1/security/status` (anomalies + renew + lattice) |
| `api/federation/index.mjs` | `allowHigh` when `CHAT_OPEN=1` or `FEDERATION_ALLOW_HIGH=1` |
| `scripts/smoke-test.sh` | durable smoke; publish before sensitive writes |
| `test/jacobian.test.mjs` | pure unit checks for Jacobian, organ, policy, digest |
| `package.json` | `npm run smoke`, `npm test` |

## Verified live

- Health, spectrum, multi-tick belief trajectory, chat session
- Quorum write → `READY` + evidence digest
- Federation publish under lab open mode
- T = B(1-B) at B=0.55 → 0.2475

## Suggested operator sequence

```bash
CONTROL12_CHAT_OPEN=1 CONTROL12_PLATFORM_ROOT=/tmp/c12-state \
  nohup node platform/src/server.mjs > /tmp/c12-server.log 2>&1 &
cd platform && npm test && npm run smoke
```
