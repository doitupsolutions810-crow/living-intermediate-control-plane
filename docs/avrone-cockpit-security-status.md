# Avrone cockpit ← security/status

`avrone-chat/lib/avrone-client.ts` (`fetchPlatformSnapshot`) prefers:

`GET {CONTROL12_PLATFORM_URL}/api/v1/security/status`

and maps:

| Field | UI |
|-------|-----|
| `severity` / `anomalies` | severity line |
| `lattice.belief` / `lattice.tension` | belief/tension |
| `mtls` / `dualCa` / `chatOpen` / `requireQuorum` | gates line |

Local `avrone-chat/app/page.tsx` includes the header strip. If remote page lags, merge those fields from the living intermediate control plane working tree.

## Profiles

- `platform/profiles/lab.env.example` — CHAT_OPEN=1
- `platform/profiles/production.env.example` — CHAT_OPEN=0, REQUIRE_QUORUM=1

## Federation

```bash
bash platform/scripts/federation-two-node-smoke.sh
# PASS: two-node federation
```
