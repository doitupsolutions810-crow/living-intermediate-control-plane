# Active OPA / Conftest policy for Trivy JSON reports
# Customized deny rules for the Living Intermediate Control Plane
#
#   conftest test --policy policy data/trivy-report.json

package main

import future.keywords.if
import future.keywords.in

# ── Severity gates ───────────────────────────────────────────────────

deny[msg] if {
	some result in input.Results
	some vuln in result.Vulnerabilities
	vuln.Severity == "CRITICAL"
	msg := sprintf("CRITICAL vulnerability not allowed: %s in %s", [vuln.VulnerabilityID, vuln.PkgName])
}

deny[msg] if {
	some result in input.Results
	some vuln in result.Vulnerabilities
	vuln.Severity == "HIGH"
	msg := sprintf("HIGH vulnerability not allowed: %s in %s", [vuln.VulnerabilityID, vuln.PkgName])
}

# ── Package denylist (customize as needed) ───────────────────────────
# Deny findings on packages that must not appear in this plane's image/repo.

denied_packages := {
	"openssl-1.0",  # example legacy marker — replace with real denials as required
}

deny[msg] if {
	some result in input.Results
	some vuln in result.Vulnerabilities
	some pkg in denied_packages
	contains(lower(vuln.PkgName), lower(pkg))
	msg := sprintf("denied package family '%s' found via %s (%s)", [pkg, vuln.PkgName, vuln.VulnerabilityID])
}

# ── Secrets scanner findings ─────────────────────────────────────────
# Trivy secret results use Category / RuleID / Severity fields.

deny[msg] if {
	some result in input.Results
	some secret in result.Secrets
	secret.Severity == "CRITICAL"
	msg := sprintf("CRITICAL secret finding: %s (%s)", [secret.RuleID, secret.Title])
}

deny[msg] if {
	some result in input.Results
	some secret in result.Secrets
	secret.Severity == "HIGH"
	msg := sprintf("HIGH secret finding: %s (%s)", [secret.RuleID, secret.Title])
}

# ── Misconfiguration (HIGH/CRITICAL only) ────────────────────────────

deny[msg] if {
	some result in input.Results
	some mc in result.Misconfigurations
	mc.Severity == "CRITICAL"
	msg := sprintf("CRITICAL misconfiguration: %s — %s", [mc.ID, mc.Title])
}

deny[msg] if {
	some result in input.Results
	some mc in result.Misconfigurations
	mc.Severity == "HIGH"
	msg := sprintf("HIGH misconfiguration: %s — %s", [mc.ID, mc.Title])
}

# ── Report integrity ─────────────────────────────────────────────────

deny[msg] if {
	not input.Results
	msg := "Trivy report missing Results array — treat as policy failure"
}
