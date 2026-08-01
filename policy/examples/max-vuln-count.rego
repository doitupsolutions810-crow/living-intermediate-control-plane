# Example: cap total vulnerability count (any severity)

package examples.max_vuln_count

import future.keywords.if
import future.keywords.in

max_vulns := 25

total_vulns := count([v |
	some result in input.Results
	some v in result.Vulnerabilities
])

deny[msg] if {
	total_vulns > max_vulns
	msg := sprintf("vulnerability count %d exceeds max %d", [total_vulns, max_vulns])
}
