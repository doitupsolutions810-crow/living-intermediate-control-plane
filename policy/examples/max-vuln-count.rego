# Example Rego policy — cap total vulnerability count (any severity)
#
# Useful as a regression guard: fail if the report grows beyond a threshold.

package examples.max_vuln_count

import future.keywords.if
import future.keywords.in

# Adjust threshold as needed
max_vulns := 25

total_vulns := count([v |
	some result in input.Results
	some v in result.Vulnerabilities
])

deny[msg] if {
	total_vulns > max_vulns
	msg := sprintf("vulnerability count %d exceeds max %d", [total_vulns, max_vulns])
}
