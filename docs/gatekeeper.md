# OPA Gatekeeper for Kubernetes

Gatekeeper enforces Rego at **admission time** in the cluster. This is separate from Conftest on Trivy/Snyk scan JSON.

## Policies included

| Constraint | Effect |
|------------|--------|
| Deny privileged | Blocks `securityContext.privileged: true` |
| Require non-root | Requires `runAsNonRoot` on pod or container |
| Deny `:latest` | Blocks unpinned / latest tags |

Matches the plane image design: distroless, non-root, version-pinned tags.

## Apply

```bash
kubectl apply -f k8s/gatekeeper/
```

See `k8s/gatekeeper/README.md`.

## Vs Conftest

| Tool | When |
|------|------|
| Conftest | CI / local on Trivy & Snyk JSON |
| Gatekeeper | Kubernetes API admission for Pods |
