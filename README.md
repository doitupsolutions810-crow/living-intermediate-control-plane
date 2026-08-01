# Living Intermediate Control Plane

Version **0.9.1**

## Next ops

1. Set GitHub secret **`SNYK_TOKEN`**  
2. On next **main** push, confirm **GHCR** package + **Cosign** sign/verify in Actions  
3. Enable **`plane-unattended.timer`** on the operator host  
4. Use **`plane agent-chat`** only for toolkit work under `workspace/`  

Details: **`docs/next-ops.md`**

```bash
plane progress
plane unattended
plane supply-chain
plane admit-change
```

## Success criteria

1. Readiness is READY  
2. Evidence is available  
3. Supply-chain enforcement stays active  
