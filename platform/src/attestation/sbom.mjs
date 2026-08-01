import crypto from 'node:crypto';

export function buildSbom({ name = 'living-intermediate', components = [] } = {}) {
  const doc = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: { type: 'application', name }
    },
    components: components.map(c => ({
      type: c.type || 'library',
      name: c.name,
      version: c.version || '0.0.0'
    }))
  };
  doc.sha256 = crypto.createHash('sha256').update(JSON.stringify(doc)).digest('hex');
  return doc;
}
