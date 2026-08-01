# Example: deny HIGH/CRITICAL only when a fix is available
# (stricter on fixable issues; leaves unfixed for separate tracking)

package examples.deny_fixed_only

import future.keywords.if
import future.keywords.in

deny[msg] if {
	some result in input.Results
	some vuln in result.Vulnerabilities
	vuln.Severity == "CRITICAL"
	vuln.FixedVersion != ""
	msg := sprintf("fixable CRITICAL %s in %s (fixed in %s)", [vuln.VulnerabilityID, vuln.PkgName, vuln.FixedVersion])
}

deny[msg] if {
	some result in input.Results
	some vuln in result.Vulnerabilities
	vuln.Severity == "HIGH"
	vuln.FixedVersion != ""
	msg := sprintf("fixable HIGH %s in %s (fixed in %s)", [vuln.VulnerabilityID, vuln.PkgName, vuln.FixedVersion])
}
