# OPA / Conftest policy for Snyk JSON reports
# Compatible with `snyk test --json` and `snyk container test --json` shapes.
#
#   conftest test --policy policy/snyk-results.rego data/snyk-test.json
#
# Severities in Snyk JSON are typically lowercase: critical, high, medium, low

package snyk

import future.keywords.if
import future.keywords.in

# Normalize vulnerability list across Snyk report variants
vulns[v] if {
	some v in input.vulnerabilities
}

vulns[v] if {
	some v in input.vulnerabilities
}

# Some container reports nest under runs / issues — keep simple top-level path first

severity_of(v) := lower(v.severity) if {
	is_string(v.severity)
}

pkg_of(v) := v.packageName if {
	is_string(v.packageName)
} else := v.package if {
	is_string(v.package)
} else := "unknown"

id_of(v) := v.id if {
	is_string(v.id)
} else := v.identifiers.CVE[0] if {
	count(v.identifiers.CVE) > 0
} else := "unknown"

# ── Severity gates ───────────────────────────────────────────────────

deny[msg] if {
	some v in input.vulnerabilities
	severity_of(v) == "critical"
	msg := sprintf("Snyk CRITICAL not allowed: %s in %s", [id_of(v), pkg_of(v)])
}

deny[msg] if {
	some v in input.vulnerabilities
	severity_of(v) == "high"
	msg := sprintf("Snyk HIGH not allowed: %s in %s", [id_of(v), pkg_of(v)])
}

# ── Explicit fail when Snyk marks report not ok and vulns present ─────

deny[msg] if {
	input.ok == false
	count(input.vulnerabilities) > 0
	some v in input.vulnerabilities
	severity_of(v) == "critical"
	msg := sprintf("Snyk report ok=false with CRITICAL %s", [id_of(v)])
}

# ── Package denylist (align with Trivy policy intent) ────────────────

denied_packages := {
	"openssl-1.0",
}

deny[msg] if {
	some v in input.vulnerabilities
	some pkg in denied_packages
	contains(lower(pkg_of(v)), lower(pkg))
	msg := sprintf("Snyk denied package family '%s' via %s (%s)", [pkg, pkg_of(v), id_of(v)])
}
