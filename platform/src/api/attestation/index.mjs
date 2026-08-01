import { buildSbom } from '../../attestation/sbom.mjs';
import { buildInTotoStatement } from '../../attestation/in-toto.mjs';
import { digestPolicy } from '../../attestation/policy-digest.mjs';

export function createAttestationApi({ registry, policySnapshot }) {
  return {
    async sbom() {
      const components = (await registry.list()).map(c => ({
        name: c.id || c.name,
        version: c.version || '1.0.0',
        type: 'library'
      }));
      return buildSbom({ components });
    },
    async statement(extra = {}) {
      const components = await registry.list();
      return buildInTotoStatement({
        subject: components.map(c => ({
          name: c.id,
          digest: { sha256: c.digest }
        })),
        predicate: { ...extra, policy: digestPolicy(policySnapshot) }
      });
    },
    policyDigest() {
      return digestPolicy(policySnapshot);
    }
  };
}
