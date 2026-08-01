# Operator Summary

```bash
npm run init
npm run next          # what to do based on current state
npm run procure       # full check
npm run procure:gated # full check only if doctor passes
npm run doctor
npm run security-summary
npm run report
```

## Success criteria

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement remains active  

## Doctor gate

Optional stricter procure:

```bash
npm run procure:gated
# or set config gateDoctorOnProcure: true
# or GATE_DOCTOR=1
```

If doctor fails, decision is `HOLD_DOCTOR`.
