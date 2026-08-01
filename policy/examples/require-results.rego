# Example Rego policy — require a well-formed Trivy report
#
# Ensures the scan produced a Results array (guards against empty/failed scans
# being treated as success).

package examples.require_results

import future.keywords.if

deny[msg] if {
	not input.Results
	msg := "scan report must include Results"
}

deny[msg] if {
	count(input.Results) == 0
	msg := "scan report Results array is empty"
}
