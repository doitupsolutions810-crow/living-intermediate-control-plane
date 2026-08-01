# CI integration

## plane-checks job (automated verification)

1. Init  
2. **upgrade-check**  
3. **verify-changes**  
4. Doctor  
5. Self-test  
6. Health  
7. Checklist  
8. Smoke (workflow) / dry-run procure  
9. Trivy FS  
10. Optional Snyk  

Local mirror:

```bash
npm run ci
```

## docker-build job

Buildx image, doctor in image, Cosign (best-effort), Trivy image, OPA, optional Snyk, SARIF.

## Verify changes in CI

`verify-changes` fails the job if:

- Required docs/scripts are missing  
- Cron is duplicated into `docs/daily-loop.md`  
- Cron template is missing or incomplete  

See `docs/verify-changes.md`.
