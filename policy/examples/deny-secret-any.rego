# Example: deny any Trivy secret finding regardless of severity

package examples.deny_secret_any

import future.keywords.if
import future.keywords.in

deny[msg] if {
	some result in input.Results
	some secret in result.Secrets
	msg := sprintf("secret finding not allowed: %s (%s)", [secret.RuleID, secret.Title])
}
