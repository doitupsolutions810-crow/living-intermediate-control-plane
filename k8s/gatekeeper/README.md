# OPA Gatekeeper (Kubernetes)

These manifests enforce runtime policy on the cluster (admission control), separate from Conftest checks on Trivy/Snyk JSON.

## Prerequisites

- Gatekeeper installed in the cluster  
  https://open-policy-agent.github.io/gatekeeper/website/docs/install/

## Manifests

| File | Purpose |
|------|--------|
| `template-deny-privileged.yaml` | ConstraintTemplate: deny privileged pods |
| `constraint-deny-privileged.yaml` | Constraint: apply to all namespaces (example) |
| `template-require-nonroot.yaml` | ConstraintTemplate: require runAsNonRoot |
| `constraint-require-nonroot.yaml` | Constraint: apply to selected namespaces |
| `template-deny-latest-tag.yaml` | ConstraintTemplate: deny `:latest` images |
| `constraint-deny-latest-tag.yaml` | Constraint: cluster-wide example |

## Apply

```bash
kubectl apply -f k8s/gatekeeper/template-deny-privileged.yaml
kubectl apply -f k8s/gatekeeper/constraint-deny-privileged.yaml

kubectl apply -f k8s/gatekeeper/template-require-nonroot.yaml
kubectl apply -f k8s/gatekeeper/constraint-require-nonroot.yaml

kubectl apply -f k8s/gatekeeper/template-deny-latest-tag.yaml
kubectl apply -f k8s/gatekeeper/constraint-deny-latest-tag.yaml
```

Aligns with the plane's distroless non-root image posture: no privileged containers, non-root, pinned tags.
