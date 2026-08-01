# Example Rego policy — deny CRITICAL only (stricter teams may keep HIGH in main policy)
#
# Copy or adapt into policy/ if you want CRITICAL-only enforcement.
# Test with:
#   conftest test --policy policy/examples/deny-critical-only.rego trivy-report.json

package examples.critical_only

import future.keywords.if
import future.keywords.in

deny[msg] if {
	some result in input.Results
	some vuln in result.Vulnerabilities
	vuln.Severity == "CRITICAL"
	msg := sprintf("CRITICAL not allowed: %s", [vuln.VulnerabilityID])
}
