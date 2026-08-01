/**
 * Agent orchestration surface — five-role CONTROL12 set
 * planner | engineer | artifact | operations | verifier
 * Wired for LaunchDesk actions under Control704 override
 */

export const ROLES = ['planner', 'engineer', 'artifact', 'operations', 'verifier'];

export function createOrchestrationPlan(goal) {
  return {
    goal,
    roles: ROLES.map(role => ({
      role,
      status: 'READY',
      capability: `control12-${role}`,
    })),
    quorumRequired: true,
    provider: 'deterministic-local-evidence',
    overall: 'READY',
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
