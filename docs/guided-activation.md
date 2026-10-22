# Guided activation and mitigation policy

## Purpose

Reduce operator technical work without allowing an unverified deployment to execute agents or external tools. Safe preview is always available; live execution is blocked until every gate passes.

The guide and readiness helper evaluate supplied evidence only. They do not connect PostgreSQL, deploy the application, create credentials, start workers, or verify an evidence reference automatically.

## One canonical set of eight success criteria

All eight criteria are required for the exact release. Each item needs a positive, reviewable evidence reference observed within the last 24 hours. Evidence timestamps must explicitly use UTC (Z or +00:00), and the evidence release digest must match the deployed release digest. To tolerate small clock skew, timestamps up to five minutes in the future are accepted; anything beyond that blocks readiness.

1. CI passed (ciPassed): build and automated tests ran on a real runner and finished green for this release. A job that failed before its first step is not a test result.
2. PostgreSQL integration passed (postgresIntegrationPassed): connect to a disposable PostgreSQL 16 database, verify migrations/schema/foreign keys/triggers, and run integration/concurrency tests. Database reachability and schema currency are subchecks of this one gate.
3. Tenant isolation passed (tenantIsolationPassed): demonstrate that tenant A cannot read, claim, or mutate tenant B's data.
4. Staging security review passed (stagingSecurityReviewPassed): review TLS, authentication, least privilege, network exposure, credential handling, and audit behavior.
5. Backup and restore passed (backupRestorePassed): restore a recent backup into an isolated environment and validate the restored data and application.
6. Worker identity verified (workerIdentityVerified): verify tenant-bound, scoped, active credentials and exercise rotation/revocation.
7. Executor health passed (executorHealthPassed): the approved HTTPS executor/model endpoint passes a non-destructive health probe.
8. Operator approval recorded (operatorApproved): an authorized human inspects the evidence and approves this exact release.

A reference is not proof by itself. A reviewer must open and inspect each reference. Synthetic test fixtures, a configured URL without a handshake, a created backup without a restore, or a task queue without an executor do not count as successful evidence.

## Outcomes

- SAFE_PREVIEW_ONLY: preview, local health checks, read-only review, and dry-run planning remain available. Live workers, external write tools, and production budget mutations stay blocked.
- READY_FOR_OPERATOR_APPROVAL: all eight evidence criteria are fresh and positive for the exact release. This is a readiness decision only; it does not deploy or start workers by itself.

Missing, stale, malformed, mismatched-release, or negative evidence means NO-GO. Future-dated timestamps beyond the five-minute clock-skew tolerance also mean NO-GO.

## Low-complexity mitigation loop

1. Run the readiness check in preview mode. Do not enable workers.
2. Follow the first blocker it reports, such as connecting a database, running the integration suite, completing a restore test, or adding an executor health result.
3. Retest only that criterion and replace old evidence with a timestamped reference.
4. Re-run the full gate; every criterion must pass within the same 24-hour evidence window.
5. Have an authorized operator review the evidence and approve the exact release.
6. If any check expires or a dependency becomes unhealthy, revert to preview-only and revoke/suspend worker credentials until reverified.

Never work around a blocker by hand-editing evidence to passed, logging secrets, or claiming a connection exists because a URL or setting is present.

## Connection inventory (last checked 2026-10-22)

| Connection | Confirmed state | Minimum closure evidence |
|---|---|---|
| GitHub repository | Connected and readable | A real runner executes all steps and completes the exact-release CI job green |
| GitHub Actions | Repeated hosted jobs fail before steps start (runner_id: 0, empty steps) | Check Actions eligibility/policy and escalate to GitHub Support if settings appear normal; then rerun |
| PostgreSQL / Supabase | Not connected in this session | Connect provider; use a disposable PostgreSQL 16 database; run migration and integration suite |
| Hosting / Vercel | Not connected in this session | Connect provider, identify the intended project/root directory, and obtain a successful preview deployment |
| Replit app | Provider integration installed, but no AVRONE app found by title search | Authorize or identify the existing intended app; do not create a duplicate based on a guessed name |
| Evidence console | Public endpoint has been reported as returning 404; no current successful live contract check is evidenced | Confirm a real HTTP response and expected schema, or label local evidence temporary |
| External model executor | No endpoint/secret handshake confirmed | Add approved HTTPS URL/model/API key to secret storage, then run the non-destructive probe |
| Lattice/control-plane link | No production URL/token handshake confirmed | Configure URL/token in secret storage and verify an expected read-only security/status response |

A provider is connected only after a real handshake and safe test action—not after installing a connector or adding an environment variable.

## How to run

From the repository root:

    node --test platform/test/activation-readiness.test.mjs

The test suite uses synthetic evidence and a fixed clock. It validates policy logic only; it does not connect services or constitute production evidence.

## Safety boundary

The readiness helper does not change runtime switches or call a model, create evidence, deploy, write production data, or start agents. Live activation still requires the production bridge's own runtime controls, real infrastructure evidence, and human release authorization.


## Activation is not an on-switch

The result `READY_FOR_OPERATOR_APPROVAL` means only that the submitted evidence meets the policy. The platform adapter always reports `executionEnabled: false` and exposes `readyForOperatorApproval` separately. Deployment controls and an authorized operator must still perform any later activation; this readiness check cannot do it.
