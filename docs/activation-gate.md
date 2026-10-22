# AVRONE Activation Gate — plain-language operator guide

## What is enabled now?

**Safe preview only.** The system can be checked, reviewed, and exercised in dry-run mode. Live workers, external write tools, and production budget mutations stay off by default.

The gate says GO only when all eight success criteria have recent evidence. It does not create evidence and it never turns the runtime on by itself.

## The eight green lights

1. **Build and tests:** the exact release has a successful CI result.
2. **Real database test:** PostgreSQL 16 integration ran against a disposable database and passed.
3. **Tenant separation:** one tenant cannot read, claim, or mutate another tenant's data.
4. **Staging safety review:** an operator reviewed authentication, TLS, permissions, and exposure.
5. **Restore test:** a backup was restored successfully, not just created.
6. **Worker identity:** credentials are active, properly scoped, and rotation has been checked.
7. **Executor health:** the specific authorized execution service answered its health check.
8. **Human approval:** an authorized operator approved the exact release for live use.

Every item must be marked passed, have a reference to supporting evidence, and be less than 24 hours old. The release identifier must match the release being enabled. Missing or stale evidence means **NO-GO**.

## Check the system without starting workers

Run:

    npm run activation:check

This defaults to safe preview and must not start agents or write to production. To inspect whether a prepared evidence file meets the policy:

    node status/activation-gate.mjs --mode live --evidence /secure/path/activation-evidence.json

The file should be created only after all eight checks are actually completed. Store it with controlled permissions and keep its evidence references reviewable. Do not commit secrets or production tokens.

The evidence shape is avrone.activation-evidence/v1; required fields are environment=production, releaseSha equal to the deployed AVRONE_RELEASE_SHA, UTC issuedAt/expiresAt (maximum 24 hours), and the eight checks with passed=true, observedAt, and a non-empty reference. If AVRONE_RELEASE_SHA is missing or does not match exactly, live execution is blocked. A passing file is an operator record, not cryptographic proof that the references themselves are genuine.

## What the execution service enforces

The optional Python executor refuses /v1/chat/completions unless both of these conditions hold:

- ALLOW_AGENT_EXECUTION=true and AVRONE_ACTIVATION_MODE=live are explicitly set; and
- AVRONE_ACTIVATION_EVIDENCE_FILE points to fresh, complete evidence that satisfies the same policy; and\n- AVRONE_RELEASE_SHA matches the exact deployed build.

The default is preview. Merely setting ALLOW_AGENT_EXECUTION=true is no longer enough. The health response exposes only a short status summary, not evidence references.

## Connections and current blockers

| Connection | Current verification | Action needed |
|---|---|---|
| GitHub repository | Repository is accessible; recent Actions jobs have failed before executing steps | Restore hosted-runner service, then require a green run for this release |
| PostgreSQL | No live test database has been verified from this work session | Connect a disposable PostgreSQL 16 database; run the actual integration suite |
| Hosting (Vercel) | The repository includes a Vercel-ready avrone-chat/ app; no usable Vercel connection is confirmed in this session | Connect the hosting account, confirm the project points at this repository and avrone-chat/, then preview deploy |
| Replit | Provider integration is present, but no AVRONE app was returned by the current account search | Open the intended app in the connected account or use the hosting integration chosen for this project |
| Evidence console | Repository documentation says the public evidence-console was previously returning 404; this must be rechecked live | Confirm a real 200 response and contract, or explicitly keep local evidence as temporary authority |
| External agent executor | The Python bridge's current swarm response identifies itself as a provisional stub and says no external model is bound in that lab plane | Connect and authenticate the intended executor; verify it before enabling live workers |

A service is not connected just because an environment variable or source file exists. The operator must verify a successful handshake, expected identity, and a safe test action.

## Rollback rule

If any success criterion goes red, expires, or cannot be checked: stay in preview, run npm run pause where supported, revoke the suspect worker credential, and do not repeat the production write until the cause is understood. Only resume after the relevant evidence is fresh again.

## Current recommendation

**GO:** preview checks and dry-run planning.  
**NO-GO:** autonomous workers, production writes, or budgeted execution until PostgreSQL integration, staging review, backup restore, executor health, and operator approval are documented for the exact release.

## What to do with the current connected services

- **GitHub:** repository access is confirmed, but the recent hosted Actions jobs failed before any step ran. Treat CI as unverified until a full run completes.
- **Database:** connect a disposable PostgreSQL 16 instance first. Do not use production for the first migration or concurrency run.
- **Website hosting:** connect Vercel and verify the project points to this GitHub repository with avrone-chat/ as the root directory. Publish a preview first.
- **App editor:** Replit search returned no visible AVRONE app. Do not create or publish a duplicate until the intended app/account is identified.
- **Executor:** keep ALLOW_AGENT_EXECUTION=false until the Python gate and exact release evidence pass. The current source describes the lab swarm output as provisional and not bound to an external model.
