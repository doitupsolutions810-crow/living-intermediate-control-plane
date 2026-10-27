#!/usr/bin/env node
/**
 * Live release gate for the public evidence producer.
 *
 * This deliberately fails closed: local fallback, HTTP reachability, and a
 * successful response alone are not sufficient. Both the public status payload
 * and its independently fetched schema must pass the v5.4.0 contract.
 */
import { probeEvidenceConsole } from '../lib/evidence-console.mjs';

const result = await probeEvidenceConsole({ acceptLocal: false });
const accepted =
  result.status === 'ok' &&
  result.authority === 'public' &&
  result.trustContractVerified === true;

console.log(JSON.stringify({
  gate: 'public-evidence-console-v5.4.0',
  accepted,
  status: result.status,
  authority: result.authority,
  trustContractVerified: result.trustContractVerified === true,
  url: result.url,
  schemaUrl: result.schemaUrl,
  trustFailures: result.trustFailures,
  checkedAt: result.checkedAt,
  note: accepted
    ? 'Public evidence contract verified. Producer authenticity still requires an independently configured signature/identity check.'
    : 'HOLD: live public status/schema contract did not verify; local fallback cannot satisfy this release gate.'
}, null, 2));

if (!accepted) process.exitCode = 1;
