# System Success Criteria (plain-language operator version)

This file separates **procurement readiness** from **production activation**. A green procurement result never authorizes live agents or production writes.

## A. Procurement readiness

Proceed to the next procurement stage only when all three are true:

1. **Local readiness is READY** — deterministic local evidence reports READY, five roles are READY, and there are zero failed gates.
2. **Evidence authority is explicit** — either the public evidence console returns the expected v5.3.1 contract, or an authorized operator explicitly accepts local plane status as temporary authority with `ACCEPT_LOCAL_EVIDENCE=1`. A missing/404 public endpoint must be disclosed; it is not proof of external readiness.
3. **Supply-chain checks are active and passing** — inspect the current branch and check results. Do not infer that a draft pull request is merged or enforced on main.

If these pass, the result is `READY_FOR_PROCUREMENT` only. Production acceptance (G1–G6) remains a separate decision.

## B. Production activation — eight required green lights

Live workers, external write tools, and production budget mutations remain **OFF** unless all eight checks below have fresh evidence for the exact release:

1. CI ran its steps and passed for the exact release.
2. PostgreSQL 16 integration passed against a disposable test database.
3. Tenant isolation passed, including cross-tenant read/write and worker-claim attempts.
4. A staging security review approved authentication, TLS, permissions, and exposure.
5. A backup was restored successfully and the result was checked.
6. Worker identity, scope, expiry, and rotation were verified.
7. The intended executor answered a real health check and is bound to the approved runtime.
8. An authorized operator approved the exact release.

Each item must have a reviewable evidence reference, a UTC observation timestamp, and be no older than 24 hours. The evidence release digest must match `AVRONE_RELEASE_SHA`. Missing, stale, mismatched, or unverifiable evidence means **NO-GO**.

## C. Connection inventory — verified 2026-10-22

This inventory is a snapshot, not a permanent guarantee. Recheck each connection before rollout.

| Connection | Verified state | Next action |
|---|---|---|
| GitHub repository | Accessible. PR #12 (safe activation gate) is open and draft, not merged. | Keep draft until a real CI run executes steps and passes. |
| GitHub Actions | Latest activation-gate and Plane CI runs failed before steps were recorded; job step lists were empty and log retrieval returned `BlobNotFound`. | Restore runner startup, then rerun and require passing results. Treat CI as unverified. |
| Vercel hosting | A Vercel status check exists but is still pending for the latest activation branch; no healthy preview is confirmed. | Connect the Vercel account integration, inspect the failed deployment, and obtain a healthy preview before relying on it. |
| PostgreSQL/Supabase | No live PostgreSQL 16 integration result is available in this work session; no Supabase project connection is confirmed. | Connect a disposable database, apply the real schema, run the integration suite, and preserve the run URL/log as evidence. |
| Replit | Integration is available, but the current app search returned no accessible AVRONE app. | Do not create a duplicate. Open/select the intended app or choose the confirmed Vercel deployment path. |
| External executor | The Python bridge is a provisional lab stub; no external model/executor binding is verified. | Connect the intended executor, authenticate it, and prove health plus a safe non-production test before enabling workers. |
| Backup/restore | No restore evidence is present in the reviewed activation record. | Restore a backup into an isolated environment and record the result. |
| Operator approval | No approval record for the exact production release is present. | Approve only after all seven technical checks above pass. |

## D. Safe decision rule

- **GO:** local review, health checks, read-only inspection, and dry-run planning.
- **NO-GO:** live workers, external tool writes, production budget mutations, or production rollout while any activation check is missing.
- If a criterion turns red or expires: remain in preview, pause supported work, revoke a suspect worker credential, and investigate before retrying.

The activation gate evaluates operator evidence; it cannot prove that a pasted evidence reference is genuine. Review the evidence itself. Never put tokens, database URLs, or other secrets in the evidence file or commit them to Git.
