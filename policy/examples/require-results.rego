# Example: require a well-formed Trivy report

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
