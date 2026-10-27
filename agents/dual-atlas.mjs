/**
 * Dual-atlas role assignment from Great Scale residual partition 4+3+1.
 * Single source: lib/great-scale-residual.mjs
 *
 * 4 → Watch   (largest residual share — monitor / guard cone)
 * 3 → Observer (rank / score claims against laws)
 * 1 → Forward  (advance / propose next residual step)
 */
import {
  atlasRole,
  RESIDUAL_PARTITION,
  DUAL_ATLAS,
  residualSnapshot,
  coneCompliant,
} from '../lib/great-scale-residual.mjs';

/** Canonical block sequence for multi-agent swarms (matches great_scale_observer) */
export const ROLE_BLOCKS = Object.freeze([4, 4, 4, 4, 3, 3, 3, 1, 1]);

/**
 * Assign dual-atlas role from agent id (deterministic partition sampling).
 */
export function assignDualAtlasRole(agentId) {
  const block = ROLE_BLOCKS[Math.abs(Number(agentId) || 0) % ROLE_BLOCKS.length];
  return {
    block,
    role: atlasRole(block),
    partition: RESIDUAL_PARTITION,
  };
}

/**
 * Enrich an agent record with dual-atlas and residual snapshot.
 */
export function withDualAtlas(agent, { S = 0, tau = null } = {}) {
  const id = agent.id ?? agent.agentId ?? 0;
  const { block, role } = assignDualAtlasRole(id);
  const residual = residualSnapshot({ S, tau, roleBlock: block });
  return {
    ...agent,
    dualAtlas: {
      block,
      role,
      partition: RESIDUAL_PARTITION,
      map: DUAL_ATLAS,
    },
    residual,
    coneOk: residual.coneOk,
  };
}

/**
 * Map CONTROL12 orchestration roles onto dual-atlas residual roles.
 * Preserves original CONTROL12 names while attaching residual identity.
 */
export function control12WithDualAtlas(control12Role, agentId = 0) {
  const base = assignDualAtlasRole(agentId);
  const map = {
    planner: { residualHint: 'Observer', notes: 'ranks plans against residual laws' },
    engineer: { residualHint: 'Forward', notes: 'advances residual proposals' },
    artifact: { residualHint: 'Watch', notes: 'guards cone and partition integrity' },
    operations: { residualHint: 'Watch', notes: 'monitors live residual floor' },
    verifier: { residualHint: 'Observer', notes: 'scores claims against cone + laws' },
  };
  const hint = map[control12Role] || { residualHint: base.role, notes: '' };
  return {
    control12Role,
    ...base,
    residualHint: hint.residualHint,
    notes: hint.notes,
  };
}

export { atlasRole, RESIDUAL_PARTITION, DUAL_ATLAS, residualSnapshot, coneCompliant };
