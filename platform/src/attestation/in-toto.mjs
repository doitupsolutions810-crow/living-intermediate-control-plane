import crypto from 'node:crypto';

export function buildInTotoStatement({
  predicateType = 'https://control12.local/attestation/v1',
  subject = [],
  predicate = {}
} = {}) {
  const statement = {
    _type: 'https://in-toto.io/Statement/v1',
    subject,
    predicateType,
    predicate: {
      ...predicate,
      generatedAt: new Date().toISOString()
    }
  };
  statement.sha256 = crypto
    .createHash('sha256')
    .update(JSON.stringify(statement))
    .digest('hex');
  return statement;
}
