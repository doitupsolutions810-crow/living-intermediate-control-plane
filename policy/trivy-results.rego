# OPA / Conftest policy for Trivy JSON reports
# Enforce: no CRITICAL or HIGH findings remain after Trivy filtering.
#
# Usage:
#   conftest test --policy policy trivy-report.json

package main

import future.keywords.if
import future.keywords.in

deny[msg] if {
	some result in input.Results
	some vuln in result.Vulnerabilities
	vuln.Severity == "CRITICAL"
	msg := sprintf("CRITICAL vulnerability not allowed: %s (%s)", [vuln.VulnerabilityID, vuln.PkgName])
}

deny[msg] if {
	some result in input.Results
	some vuln in result.Vulnerabilities
	vuln.Severity == "HIGH"
	msg := sprintf("HIGH vulnerability not allowed: %s (%s)", [vuln.VulnerabilityID, vuln.PkgName])
}

deny[msg] if {
	not input.Results
	msg := "Trivy report missing Results array — treat as policy failure"
}
