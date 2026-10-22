"""Fail-closed activation evidence policy shared by AVRONE's Python executor."""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

SCHEMA = "avrone.activation-evidence/v1"
MAX_AGE = timedelta(hours=24)
REQUIRED_CHECKS = (
    "ciPassed",
    "postgresIntegrationPassed",
    "tenantIsolationPassed",
    "stagingSecurityReviewPassed",
    "backupRestorePassed",
    "workerIdentityVerified",
    "executorHealthPassed",
    "operatorApproved",
)


def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip()
    # Keep Python and Node acceptance criteria identical: explicit ISO UTC only.
    if not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)",
        normalized,
    ):
        return None
    try:
        result = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
        if result.tzinfo is None or result.utcoffset() != timedelta(0):
            return None
        return result.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def evaluate_activation(mode: str = "preview", evidence: Any = None,
                        now: datetime | None = None, expected_release_sha: str | None = None) -> dict[str, Any]:
    """Return a decision without revealing file content or secrets."""
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    selected = str(mode or "preview").lower()
    if selected == "preview":
        return {
            "decision": "SAFE_PREVIEW",
            "liveExecutionAllowed": False,
            "blockers": ["Live execution remains off in preview mode."],
        }

    blockers: list[str] = []
    checks: list[dict[str, Any]] = []
    if selected != "live":
        blockers.append("Mode must be preview or live.")
    if not isinstance(evidence, dict):
        blockers.append("Activation evidence file is missing or is not an object.")
    else:
        if evidence.get("schema") != SCHEMA:
            blockers.append("Evidence schema is not recognized.")
        if evidence.get("environment") != "production":
            blockers.append("Evidence must name the production environment.")
        release_sha = evidence.get("releaseSha")
        if not isinstance(release_sha, str) or not re.fullmatch(r"(?:[a-f0-9]{40}|[a-f0-9]{64})", release_sha, re.I):
            blockers.append("Evidence must identify the exact release with a Git or SHA-256 digest.")
        if not isinstance(expected_release_sha, str) or not re.fullmatch(r"(?:[a-f0-9]{40}|[a-f0-9]{64})", expected_release_sha, re.I):
            blockers.append("AVRONE_RELEASE_SHA must identify the deployed release.")
        elif not isinstance(release_sha, str) or release_sha.lower() != expected_release_sha.lower():
            blockers.append("Activation evidence is for a different release than the deployed release.")

        issued = _parse_time(evidence.get("issuedAt"))
        expires = _parse_time(evidence.get("expiresAt"))
        if issued is None or expires is None:
            blockers.append("Evidence issue and expiry times must be valid timezone-aware timestamps.")
        else:
            if issued > current + timedelta(minutes=5):
                blockers.append("Evidence issue time is in the future.")
            if expires <= current:
                blockers.append("Activation evidence has expired.")
            if expires <= issued or expires - issued > MAX_AGE:
                blockers.append("Evidence validity must be positive and no longer than 24 hours.")
            if current - issued > MAX_AGE:
                blockers.append("Activation evidence is older than 24 hours.")

        values = evidence.get("checks") if isinstance(evidence.get("checks"), dict) else {}
        for key in REQUIRED_CHECKS:
            item = values.get(key) if isinstance(values, dict) else None
            item = item if isinstance(item, dict) else {}
            ref = item.get("reference")
            observed = _parse_time(item.get("observedAt"))
            fresh = observed is not None and observed <= current + timedelta(minutes=5) and current - observed <= MAX_AGE
            passed = item.get("passed") is True and isinstance(ref, str) and len(ref.strip()) >= 4 and fresh
            if not passed:
                blockers.append(f"{key}: not verified or missing a fresh evidence reference.")
            checks.append({
                "id": key,
                "passed": passed,
                "referencePresent": isinstance(ref, str) and len(ref.strip()) >= 4,
                "fresh": fresh,
            })

    allowed = len(blockers) == 0
    return {
        "decision": "LIVE_APPROVED" if allowed else "BLOCKED",
        "liveExecutionAllowed": allowed,
        "passed": sum(1 for item in checks if item["passed"]),
        "required": len(REQUIRED_CHECKS),
        "checks": checks,
        "blockers": blockers,
    }


def evaluate_evidence_file(path: str | None, mode: str = "live", expected_release_sha: str | None = None) -> dict[str, Any]:
    if not path:
        return evaluate_activation(mode=mode, evidence=None, expected_release_sha=expected_release_sha)
    try:
        evidence = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        evidence = None
    return evaluate_activation(mode=mode, evidence=evidence, expected_release_sha=expected_release_sha)
