/**
 * Parse GREAT_SCALE_S without coercing malformed values to the safe-looking zero.
 * An unset variable means the documented default coordinate (0); a supplied but
 * empty, non-numeric, NaN, or infinite value is invalid and must fail closed.
 */
export function parseResidualCoordinate(raw) {
  if (raw === undefined) {
    return { valid: true, value: 0, source: 'default', error: null };
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { valid: false, value: null, source: 'environment', error: 'GREAT_SCALE_S must be a non-empty finite number when supplied.' };
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { valid: false, value: null, source: 'environment', error: 'GREAT_SCALE_S must be a finite number.' };
  }
  return { valid: true, value, source: 'environment', error: null };
}
