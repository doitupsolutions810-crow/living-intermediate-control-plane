const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Validate a supply-chain report as current authorization evidence.
 * A successful process exit alone is insufficient: skipped tools, missing
 * image/signature evidence, stale timestamps, or revision mismatch deny trust.
 */
export function evaluateSupplyChainEvidence({
  report,
  revision,
  nowMs = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS
} = {}) {
  const deny = (reason) => ({ authorized: false, reason });

  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return deny('missing-or-invalid-report');
  }
  if (typeof revision !== 'string' || !revision.trim()) {
    return deny('current-revision-unavailable');
  }
  if (report.revision !== revision) {
    return deny('revision-mismatch');
  }
  if (typeof report.timestamp !== 'string') {
    return deny('timestamp-missing');
  }

  const timestampMs = Date.parse(report.timestamp);
  const ageMs = nowMs - timestampMs;
  if (!Number.isFinite(timestampMs) || ageMs < 0 || ageMs > maxAgeMs) {
    return deny('report-stale-or-future-dated');
  }
  if (report.ok !== true || report.failed !== 0) {
    return deny('reported-failure');
  }
  if (report.allowSkip !== false) {
    return deny('soft-skip-mode-not-authoritative');
  }
  if (typeof report.imageRef !== 'string' || !report.imageRef.trim()) {
    return deny('image-reference-missing');
  }
  if (!/@sha256:[a-f0-9]{64}$/i.test(report.imageRef)) {
    return deny('image-reference-not-immutable-digest');
  }
  if (report.signed !== true) {
    return deny('signed-image-required');
  }
  if (!Array.isArray(report.results) || report.results.length === 0) {
    return deny('results-missing');
  }
  if (!report.results.every((item) => item && item.ok === true && item.skipped !== true)) {
    return deny('failed-or-skipped-step');
  }
  const scan = report.results.find((item) => item.name === 'security-scan' && item.ok === true);
  const signing = report.results.find((item) => item.name === 'cosign-sign' && item.ok === true);
  const verification = report.results.find((item) => item.name === 'cosign-verify' && item.ok === true);
  if (!scan) return deny('security-scan-not-confirmed');
  if (!signing) return deny('image-signing-not-confirmed');
  if (!verification) return deny('image-signature-verification-not-confirmed');
  if ([scan, signing, verification].some((item) => item.imageRef !== report.imageRef)) {
    return deny('scan-or-signature-result-image-mismatch');
  }

  return { authorized: true, reason: 'fresh-revision-bound-scan-and-signature-verified', ageMs };
}
