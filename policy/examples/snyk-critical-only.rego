# Example: Snyk JSON — deny CRITICAL only
#
#   conftest test --policy policy/examples/snyk-critical-only.rego data/snyk-test.json

package examples.snyk_critical_only

import future.keywords.if
import future.keywords.in

deny[msg] if {
	some v in input.vulnerabilities
	lower(v.severity) == "critical"
	msg := sprintf("Snyk CRITICAL: %s (%s)", [v.id, v.packageName])
}
