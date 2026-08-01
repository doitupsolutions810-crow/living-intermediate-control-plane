# Operator Summary

**Setup**

```bash
npm run init
```

**Daily**

```bash
npm run procure
npm run doctor
npm run security-summary
npm run report
```

**Preview**

```bash
npm run dry-run
```

**Control**

```bash
npm run pause
npm run resume
npm run state
npm run log
```

**CI / image**

```bash
npm run ci
npm run docker:build
npm run docker:doctor
```

## Success criteria (only three)

1. Readiness is READY  
2. Evidence is available (public or local accepted)  
3. Supply-chain enforcement remains active  

## Security docs

- `docs/security.md` — plain overview  
- `docs/ci.md` — pipelines  
- `docs/docker.md` / `docs/kaniko.md` — images  
- `docs/trivy.md` / `docs/slsa.md` — scan & provenance  
