# Example: deny CRITICAL vulnerabilities only
#
#   conftest test --policy policy/examples/deny-critical-only.rego data/trivy-report.json

package examples.critical_only

import future.keywords.if
import future.keywords.in

deny[msg] if {
	some result in input.Results
	some vuln in result.Vulnerabilities
	vuln.Severity == "CRITICAL"
	msg := sprintf("CRITICAL not allowed: %s", [vuln.VulnerabilityID])
}
