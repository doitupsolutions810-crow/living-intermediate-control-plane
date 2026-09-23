# Next moves (provisional)

Ordered by leverage on the live plane. None of these close the system.

## Done this session (local)

- Access log writes no longer crash the process on FS errors
- `GET /api/v1/security/status` aggregates anomalies, renew, lattice belief/tension
- `platform/scripts/smoke-test.sh` + `npm run smoke`
- Federation publish may proceed under `CHAT_OPEN=1` when severity is high from intentional lab writes

## Immediate (1-2)

1. Push platform deltas (this commit)
2. Wire Avrone cockpit UI to `/api/v1/security/status`
3. Default prod profile: `CHAT_OPEN=0`, bearer token, optional mTLS

## Near (3-5)

4. Dual-CA cutover script dry-run with openssl material under `~/.control12-mtls`
5. Root `npm test` (self-test) after full extract of `lattice/` + `status/`
6. Quorum-default writes in a non-lab profile

## Later

7. Federated peer ingest loop between two platform processes
8. Cockpit actions in Avrone page (tls_reload, federation_publish)
9. CI: platform smoke job on push

## Operator day-2 (lab)

```bash
CONTROL12_CHAT_OPEN=1 CONTROL12_PLATFORM_ROOT=/tmp/c12-state \
  node platform/src/server.mjs
cd platform && npm run smoke
```
