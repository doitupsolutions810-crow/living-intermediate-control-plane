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


const savedKey = process.env.CONTROL12_ATTEST_HMAC_KEY;
try {
  // A correct digest without a trusted HMAC key is integrity-only, not auth.
  delete process.env.CONTROL12_ATTEST_HMAC_KEY;
  const unsigned = buildSessionLink({ sessionId: 'unsigned-session' });
  const unsignedCheck = verifySessionLink(unsigned);
  assert(unsignedCheck.digestOk === true, 'unsigned digest integrity');
  assert(unsignedCheck.integrityOk === true, 'explicit integrity status');
  assert(unsignedCheck.authenticated === false, 'unsigned is not authenticated');
  assert(unsignedCheck.ok === false, 'digest-only link is not fully verified');
  assert(unsignedCheck.reason === 'trusted_hmac_key_unavailable', 'missing trust reason');

  // A signed record cannot be authenticated when the verifier lacks its trust key.
  const signedWithoutTrust = verifySessionLink(link);
  assert(signedWithoutTrust.digestOk === true, 'signed record digest remains valid');
  assert(signedWithoutTrust.authenticated === false, 'missing key cannot authenticate');
  assert(signedWithoutTrust.ok === false, 'missing key cannot produce verified success');

  process.env.CONTROL12_ATTEST_HMAC_KEY = 'test-hmac-key';
  const noSignature = { ...unsigned, signed: false, signature: null };
  const noSignatureCheck = verifySessionLink(noSignature);
  assert(noSignatureCheck.digestOk === true, 'unsigned digest is consistent');
  assert(noSignatureCheck.authenticated === false, 'unsigned record not authenticated with key');
  assert(noSignatureCheck.ok === false, 'unsigned record not verified with key');
} finally {
  if (savedKey === undefined) delete process.env.CONTROL12_ATTEST_HMAC_KEY;
  else process.env.CONTROL12_ATTEST_HMAC_KEY = savedKey;
}
console.log('session-link authenticity separation PASS');
