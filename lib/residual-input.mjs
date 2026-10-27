/**
 * Parse GREAT_SCALE_S and classify its authorization effect.
 *
 * The topology-derived coordinate is S=(1-tau^2)/4 for tau in [0,1], hence
 * the supported model domain is S in [0, 1/4]. Unset input uses the documented
 * default 0. Supplied malformed, non-finite, or out-of-domain values fail closed.
 */
import { coneCompliant } from './great-scale-residual.mjs';

const MIN_RESIDUAL_COORDINATE = 0;
const MAX_RESIDUAL_COORDINATE = 0.25;
const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

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
      error: 'GREAT_SCALE_S must be a non-empty decimal number when supplied.'
    };
  }
  const normalized = raw.trim();
  if (!DECIMAL_NUMBER.test(normalized)) {
    return {
      valid: false, value: null, gateValue: -1, source: 'environment',
      coneCompliant: false, decision: 'HOLD_INVALID_RESIDUAL',
      error: 'GREAT_SCALE_S must use decimal numeric notation.'
    };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return {
      valid: false, value: null, gateValue: -1, source: 'environment',
      coneCompliant: false, decision: 'HOLD_INVALID_RESIDUAL',
      error: 'GREAT_SCALE_S must be a finite number.'
    };
  }
  if (value < MIN_RESIDUAL_COORDINATE || value > MAX_RESIDUAL_COORDINATE) {
    return {
      valid: false, value: null, gateValue: -1, source: 'environment',
      coneCompliant: false, decision: 'HOLD_RESIDUAL_DOMAIN',
      error: 'GREAT_SCALE_S is outside the topology-derived domain [0, 0.25].'
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
