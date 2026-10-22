# System Success Criteria (kept simple)

There are two different readiness levels. They must not be conflated.

## Level 1 — ready to proceed to procurement

Only three criteria apply to this procurement decision:

1. Local readiness is READY: deterministic local evidence reports overall READY, all five roles READY, and zero failed gates.
2. Evidence authority is available: either the public evidence console returns the expected v5.3.1 contract, or an authorized operator explicitly accepts local plane status as temporary evidence authority.
3. Supply-chain enforcement remains active: the relevant PR #12 rules are present on the target branch.

When those three hold, the plane may be considered READY_FOR_PROCUREMENT. This is not production activation approval. Local readiness stubs, a graceful 404 fallback, or procurement permission do not demonstrate that the database, external executor, or worker system is production-ready.

## Level 2 — approved for production live execution

Production execution has a separate, stricter gate. All eight criteria below must pass for the exact release with reviewable evidence observed within the previous 24 hours:

1. CI ran on a real runner and passed for this release.
2. PostgreSQL 16 integration passed against a disposable database, including schema/migration/foreign-key/trigger checks.
3. Tenant isolation passed for reads, task claims, writes, and budget/audit records.
4. Staging security review passed.
5. Backup restore was successfully exercised in isolation.
6. Worker identity, scoping, rotation, and revocation were verified.
7. The approved HTTPS executor passed a non-destructive health probe.
8. An authorized operator reviewed evidence and approved the exact release digest.

The evidence must use explicit UTC timestamps, have references a reviewer can inspect, and bind to the exact release digest. Missing, stale, malformed, mismatched, or negative evidence means SAFE_PREVIEW_ONLY.

## Current blockers

- GitHub repository access is working, but hosted Actions jobs have failed before running any workflow steps (runner_id: 0, no steps). This is not a test result.
- Supabase/PostgreSQL provider connection is not confirmed.
- Vercel connection and a successful preview deployment are not confirmed.
- Replit is installed as a ChatGPT integration, but no intended AVRONE app was found.
- No external model executor URL/key/model handshake is confirmed.
- No successful current evidence-console contract response is recorded.

## Decision rule

READY_FOR_PROCUREMENT may advance procurement only. It never enables live workers.

Production enablement remains blocked until all eight production criteria pass. If any criterion fails or becomes stale, keep preview mode, stop/revoke worker access, resolve the first reported blocker, and rerun the relevant check. Do not create or edit evidence merely to make a check green.
