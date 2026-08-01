# Example: Snyk JSON — cap total vulnerability count

package examples.snyk_max_count

import future.keywords.if
import future.keywords.in

max_vulns := 20

total := count(input.vulnerabilities)

deny[msg] if {
	total > max_vulns
	msg := sprintf("Snyk vulnerability count %d exceeds max %d", [total, max_vulns])
}
