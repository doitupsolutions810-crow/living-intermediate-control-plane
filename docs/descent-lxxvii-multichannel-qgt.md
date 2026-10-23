# Descent LXXVII — Multi-channel quantum-geometry fingerprint

Status: additive diagnostic extension; mathematical identities and regression examples, not a new physical law.

## Why another descent?

The scalar Great Scale channel depends on chi = |F12|/(2 sqrt(det g)). It therefore discards curvature sign and cannot distinguish metric anisotropy at fixed determinant. For example, g = I and g = diag(4, 1/4) both have det(g) = 1; with F12 = 0 both map to S_Q = 1/4. Their metric eigenvalues differ: (1,1) versus (1/4,4).

## Extended diagnostic

Keep the existing scalar channel, and carry additional observables:
G_Q = (S_Q, F12, det(g), lambda_min(g), lambda_max(g)).
The bridge now exposes signed input curvature and the two eigenvalues of the positive-definite metric. Define anisotropy a_g = lambda_min/lambda_max in (0,1]. This preserves the original scalar semantics while exposing information previously discarded. It is not a complete invariant: metric components/eigenvalues depend on parameter coordinates, and global topology is not encoded.

## Great Scale mapping

chi = |F12|/(2 sqrt(det(g))), R = 1 - chi^2, S_Q = R/4, Psi_Q = phi^-2 + S_Q.
Auxiliary channels are F12, det(g), lambda_min, lambda_max, and a_g. Do not conflate them with scalar heat S_Q.

## Verification cases

1. Opposite signed curvatures have equal scalar heat but different signedCurvature output.
2. Isotropic g = diag(1,1) and anisotropic g = diag(4,1/4) share determinant 1 and scalar heat 1/4, but their eigenvalues and anisotropy differ.
3. The regular pure-qubit Bloch-sphere example saturates det(Q)=0 and maps to the cone floor.

Run npm test in great-scale and npm test in living-intermediate-control-plane/platform. Hosted CI must be inspected separately.
