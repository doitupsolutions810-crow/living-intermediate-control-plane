# Great Scale — Levels 9501–9600
## Profound finding: the published repository tree is not a closed executable artifact

### Executive result

A deeper recursive-tree audit of `doitupsolutions810-crow/capability-plane` on `main` found a dependency-closure failure in the committed source tree itself.

The recursive Git tree at `main` contains:
- `admin/durable_outbox.py`
- `attestpipe/__init__.py`
- `attestpipe/bus.py`

But it does **not** contain:
- `admin/outbox.py`, imported by `admin/durable_outbox.py` as `from .outbox import OutboxEvent`
- `attestpipe/messages.py`, imported by `attestpipe/bus.py` as `from .messages import Envelope`

The repository's own `NOTE_FULL_TREE.md` says complete sources may be in a separate local release ZIP / overlay. That note is useful context, but it does not make those modules part of the public `main` tree. Therefore, the public repository snapshot is not self-contained for these import paths.

This is more fundamental than a transport bug: before evaluating the outbox's runtime behavior, the exact checked-in artifact must be importable. In the public tree as inspected, importing `admin.durable_outbox` is expected to fail at the missing `admin.outbox` import. Separately, if the missing outbox model were supplied by an overlay, importing `attestpipe.bus` would encounter the missing `attestpipe.messages` import. These are source/tree conclusions; no runtime execution was performed here.

### Evidence chain

1. Recursive Git tree fetched from `https://api.github.com/repos/doitupsolutions810-crow/capability-plane/git/trees/main?recursive=1`.
2. The complete returned path list included only these files under `admin/`: `admin/durable_outbox.py` and `admin/providers/factory.py` (plus the providers directory).
3. The returned path list under `attestpipe/` included only `__init__.py` and `bus.py`.
4. `admin/durable_outbox.py` directly imports `OutboxEvent` from the absent `admin/outbox.py`.
5. `attestpipe/bus.py` directly imports `Envelope` from the absent `attestpipe/messages.py`.
6. The same recursive tree contained no paths matching test directories, `pytest`, `pyproject.toml`, or `setup.py`. This does not prove no tests exist outside the tracked tree or in a separate release artifact; it means no such test harness was visible in this public tree snapshot.

### Why the prior delivery finding becomes sharper

The outbox callback still has a source-level state transition in which a normal callback return permits `mark_published`. The optional mirror import is inside a caught exception block. Consequently, after the dependency closure is repaired enough to import the outbox module, a missing/broken AttestPipe dependency can be swallowed by the mirror path, and the callback can still return normally. A logger-only result can therefore be recorded as published unless a real transport acknowledgement is enforced.

Do not collapse these two defects into one:
- **Artifact closure defect:** the public tree is missing direct import dependencies, so the relevant modules are not importable from the tree alone.
- **Evidence-state defect:** callback completion is treated as transport success without a broker acknowledgement.

The first blocks reliable execution of the second path from the public artifact; it does not erase the second defect visible in the source.

### Great Scale mapping

Let:
- (S) = source tree is closed over all runtime imports;
- (I) = target module imports successfully in the intended environment;
- (J(O)) = real transport acknowledges operation (O);
- (P(O)) = outbox records (O) as published.

A minimum build contract is that a module's runtime imports resolve within the exact release artifact (or declared, reproducible dependencies), and that this is tested by an actual import check.

The transport contract remains:

`P(O) => J(O)`

The unsafe implementation allows:

`callback returns normally => P(O)`

without requiring `J(O)`. No amount of numerical coherence in Great Scale can repair a missing source dependency or manufacture transport evidence.

For the model's numerical side:

`CONE = φ^-2 ≈ 0.381966`

`Ψ = CONE + h(1-h), with h in [0,1]`

Since `0 <= h(1-h) <= 1/4`:

`CONE <= Ψ <= CONE + 1/4 ≈ 0.631966`.

This is a valid bounded model invariant, not a software build or message-delivery certificate. Great Scale must keep model validity, artifact validity, and operational evidence as distinct coordinates.

### Levels 9501–9510

- **9501 — Tree closure:** every direct runtime import must resolve within the release artifact or a declared, reproducible dependency.
- **9502 — Release identity:** public Git tree and external ZIP overlay must have an explicit version/hash relationship.
- **9503 — Import gate:** run import checks against the exact artifact used for deployment.
- **9504 — Test visibility:** tests must be present in, or reproducibly attached to, the same versioned release artifact.
- **9505 — Transport truth:** a successful Python callback is not a broker acknowledgement.
- **9506 — Failure propagation:** missing optional mirror dependencies may be tolerated only if clearly marked non-authoritative; missing primary transport must fail closed.
- **9507 — Published-state invariant:** `published_at` is legal only after a validated primary transport acknowledgement.
- **9508 — Immutable event identity:** bind event ID, canonicalization version, and payload digest.
- **9509 — Consumer completion:** transport acknowledgement and committed business effect remain separate states.
- **9510 — Promotion gate:** do not promote until source closure, tests, broker integration, and exact-head CI are independently verified.

### Remediation sequence

1. Decide whether the Git repository or the release ZIP is the authoritative build input. Avoid an undocumented overlay.
2. Restore and commit the missing modules (`admin/outbox.py`, `attestpipe/messages.py`) if they are intended source dependencies, or refactor imports so the public artifact is genuinely self-contained.
3. Add a deterministic import-smoke test for `admin.durable_outbox` and `attestpipe.bus` in a clean checkout.
4. Add tests that prove a missing primary transport cannot mark an event published.
5. Implement a real JetStream adapter and require a validated acknowledgement before setting `published_at`.
6. Add collision, relay-concurrency, and consumer-idempotency tests; run them against the exact release artifact.
7. Only then consider moving the integration PR out of draft.

### Verification ledger

- **Repository tree:** fetched and parsed from public `main`; relevant paths checked.
- **Missing direct import targets:** confirmed absent from the returned tracked tree.
- **Source imports:** confirmed in `admin/durable_outbox.py` and `attestpipe/bus.py`.
- **Runtime import test:** not run; conclusion is a static dependency-closure finding.
- **Repository tests/build:** not run; no test/build harness was visible in the tracked tree paths inspected.
- **ZIP overlay:** not inspected or hash-linked to `main`.
- **JetStream / production behavior:** not verified.

### Decision

The next integration milestone is **artifact closure before transport repair**. A public source tree that cannot resolve its direct imports is not yet a reproducible basis for CI, tests, or deployment. Keep the control-plane integration PR draft until the authoritative artifact is explicit and its import, transport, and consumer contracts are executed in CI.
