/**
 * Fixed-window in-memory rate limiter (per serverless instance — best effort).
 * Good enough to blunt brute force / runaway agent loops; not a global quota.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterS: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  const ok = b.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - b.count),
    retryAfterS: ok ? 0 : Math.ceil((b.resetAt - now) / 1000)
  };
}

export function resetRateLimits(): void {
  buckets.clear();
}
