/**
 * Agent orchestration surface — five-role CONTROL12 set
 * planner | engineer | artifact | operations | verifier
 * Wired for LaunchDesk actions under Control704 override
 *
 * GSLI: each role is also dual-atlas assigned from residual partition 4+3+1.
 */

import { control12WithDualAtlas, assignDualAtlasRole, RESIDUAL_PARTITION } from './dual-atlas.mjs';

export const ROLES = ['planner', 'engineer', 'artifact', 'operations', 'verifier'];

export function createOrchestrationPlan(goal, { agentIdBase = 0 } = {}) {
  return {
    goal,
    roles: ROLES.map((role, i) => {
      const dual = control12WithDualAtlas(role, agentIdBase + i);
      return {
        role,
        status: 'READY',
        capability: `control12-${role}`,
        dualAtlas: {
          block: dual.block,
          role: dual.role,
          residualHint: dual.residualHint,
          notes: dual.notes,
        },
      };
    }),
    residualPartition: RESIDUAL_PARTITION,
    quorumRequired: true,
    provider: 'deterministic-local-evidence',
    overall: 'READY',
    schema: 'great-scale.orchestration/v1',
  };
}

export function evaluateQuorum(plan) {
  const allReady = plan.roles.every(r => r.status === 'READY');
  return {
    ...plan,
    overallDecision: allReady ? 'READY' : 'NOT_READY',
    failedGates: allReady ? [] : plan.roles.filter(r => r.status !== 'READY').map(r => r.role),
  };
}

/** Swarm dual-atlas assignment for N agents */
export function assignSwarmDualAtlas(n = 9) {
  return Array.from({ length: n }, (_, id) => assignDualAtlasRole(id));
}
