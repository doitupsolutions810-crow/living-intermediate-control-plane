# OPA / Conftest policy for Trivy JSON reports
# Enforce: no CRITICAL findings; HIGH findings must be absent unless ignored upstream by Trivy.
#
# Usage:
#   conftest test --policy policy trivy-report.json
#
# Input shape: Trivy JSON (--format json)

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

# Fail closed if the report is missing Results entirely (malformed / empty scan output)
deny[msg] if {
	not input.Results
	msg := "Trivy report missing Results array — treat as policy failure"
}
