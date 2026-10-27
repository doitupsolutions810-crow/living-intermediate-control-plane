/**
 * Parse GREAT_SCALE_S and classify its authorization effect.
 * An unset variable means the documented default coordinate (0); a supplied but
 * empty, non-numeric, NaN, or infinite value is invalid and must fail closed.
 */
import { coneCompliant } from './great-scale-residual.mjs';

export function parseResidualCoordinate(raw) {
  if (raw === undefined) {
    return {
      valid: true, value: 0, gateValue: 0, source: 'default',
      coneCompliant: coneCompliant(0), decision: null, error: null
    };
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return {
      valid: false, value: null, gateValue: -1, source: 'environment',
      coneCompliant: false, decision: 'HOLD_INVALID_RESIDUAL',
      error: 'GREAT_SCALE_S must be a non-empty finite number when supplied.'
    };
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return {
      valid: false, value: null, gateValue: -1, source: 'environment',
      coneCompliant: false, decision: 'HOLD_INVALID_RESIDUAL',
      error: 'GREAT_SCALE_S must be a finite number.'
    };
  }
  const coneOk = coneCompliant(value);
  return {
    valid: true, value, gateValue: value, source: 'environment',
    coneCompliant: coneOk,
    decision: coneOk ? null : 'HOLD_RESIDUAL_CONE',
    error: null
  };
}
