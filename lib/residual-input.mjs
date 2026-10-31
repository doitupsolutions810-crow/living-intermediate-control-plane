/**
 * Parse the operator-supplied residual coordinate without coercing invalid input to zero.
 * The topology-derived contract is finite S in [0, 0.25]. An unset value remains
 * an explicitly labeled default until a trusted live measurement producer exists.
 */
const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
export const MIN_RESIDUAL = 0;
export const MAX_RESIDUAL = 0.25;

export function parseResidualInput(raw) {
  if (raw === undefined || raw === null) {
    return { valid: true, provided: false, value: 0, source: 'default', decision: 'HOLD_RESIDUAL_UNSET' };
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return { valid: false, provided: true, value: null, source: 'environment', decision: 'HOLD_INVALID_RESIDUAL' };
  }
  const normalized = raw.trim();
  if (!DECIMAL_NUMBER.test(normalized)) {
    return { valid: false, provided: true, value: null, source: 'environment', decision: 'HOLD_INVALID_RESIDUAL' };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || (value === 0 && /[1-9]/.test(normalized.split(/[eE]/, 1)[0]))) {
    return { valid: false, provided: true, value: null, source: 'environment', decision: 'HOLD_INVALID_RESIDUAL' };
  }
  if (value < MIN_RESIDUAL || value > MAX_RESIDUAL) {
    return { valid: false, provided: true, value: null, source: 'environment', decision: 'HOLD_RESIDUAL_DOMAIN' };
  }
  return { valid: true, provided: true, value, source: 'environment', decision: null };
}

/** True only when a syntactically valid residual was explicitly supplied. */
export function residualInputGateEligible(input) {
  return input?.valid === true && input?.provided === true;
}
