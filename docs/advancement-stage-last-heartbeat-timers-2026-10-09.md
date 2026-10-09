# Advancement — lastHeartbeat + timer wiring in readiness

## Verified

- dual-plane-smoke: readiness, timers_wired, heartbeat, heartbeat_all, last_heartbeat all **200**, ok:true
- multi-belief.test.mjs PASS

## Readiness fields

```json
{
  "lastHeartbeat": { "at": "...", "count": 1, "source": "api|api-all|timer" },
  "timers": {
    "consensusMs": 0,
    "pruneMs": 0,
    "heartbeatMs": 0,
    "heartbeatAnchors": false
  }
}
```

Timers default to 0 (off). Smoke asserts the object is present without waiting full intervals.

## Chat `/ready`

Prints gates plus `hb=` timestamp and `timers=c/p/h` milliseconds.

Provisional. Always another perspective.
