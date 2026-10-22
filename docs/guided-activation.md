# Guided activation and mitigation policy

## Purpose

Reduce operator technical burden without allowing an unverified deployment to execute agents or external tools. **Preview is always available; execution is not.**

This helper evaluates evidence only. It does not connect PostgreSQL, deploy the application, create credentials, or start workers.

## Plain-language success criteria

All eight gates must have a positive result verified within the last 24 hours. Missing, stale, future-dated, malformed, or negative evidence blocks execution.

1. **Database connected:** a real PostgreSQL connection succeeds.
2. **Database structure current:** required migrations, foreign keys, and immutability triggers are present.
3. **Real database tests passed:** the PostgreSQL 16 integration suite completes against a disposable test database.
4. **Staging security review passed:** tenant separation, credential boundaries, and audit controls are exercised and reviewed.
5. **Worker credentials ready:** credentials are tenant-bound, active, scoped, and stored in a secret manager.
6. **Executor connected:** a configured executor passes a non-destructive health check. A task queue alone does not count.
7. **Recovery tested:** rollback/recovery procedure has been exercised and recorded.
8. **Operator approved:** an authorized human explicitly approves execution after reviewing evidence.

## Operator outcomes

- **SAFE_PREVIEW_ONLY:** preview and non-executing validation remain available. Execution stays off, and the result lists blockers.
- **ENABLE_EXECUTION:** evidence for every gate is fresh and positive. This is a readiness decision only; it does not deploy or enable anything by itself.

## Mitigation when a gate fails

1. Keep execution disabled. Do not bypass the gate with a string, stale screenshot, or unverified claim.
2. Show the blocker and the next action: connect database, apply migration, rerun integration suite, complete security review, configure credentials, connect executor, test recovery, or approve.
3. After remediation, rerun the relevant check and replace old evidence with a timestamped result.
4. If a passing gate becomes unhealthy, return to preview-only and disable worker credentials until reverified.
5. Preserve audit events, but never log bearer secrets or raw connection strings.

## Current connection reality (checked 2026-10-22)

- GitHub repository access is connected.
- Replit integration is installed, but no AVRONE app was found by title search or exact-name resolution; do not publish a guessed app.
- No Supabase/PostgreSQL project connection is established in this session.
- GitHub Actions has repeatedly failed before any workflow steps started (`runner_id: 0`, empty step lists). That is infrastructure evidence, not a passing or failing application test.

## Test

From `platform/`, run:

```bash
node --test test/activation-readiness.test.mjs
```

These unit tests use synthetic evidence and a fixed clock. They verify the policy logic only, not live database or deployment connectivity.
