import { buildSessionLink, verifySessionLink } from '../src/attestation/session-link.mjs';

function assert(c, m) {
  if (!c) throw new Error(m || 'fail');
}

process.env.CONTROL12_ATTEST_HMAC_KEY = 'test-hmac-key';
const link = buildSessionLink({
  sessionId: 's1',
  multiBeliefDigest: 'deadbeef',
  meanBelief: 0.55,
  nodeCount: 2
});
assert(link.signed === true, 'signed');
const ok = verifySessionLink(link);
assert(ok.ok === true, 'verify ok');
assert(ok.digestOk === true, 'digest');
assert(ok.signatureOk === true, 'sig');

const tampered = { ...link, multiBeliefDigest: 'tampered' };
const bad = verifySessionLink(tampered);
assert(bad.ok === false, 'tamper detect');

console.log('session-link.test.mjs PASS');
