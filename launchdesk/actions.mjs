/**
 * LaunchDesk action bridge
 * Accepts simple operator requests and routes them through the five-role orchestration layer
 */

import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';

export function handleLaunchDeskAction(actionName, goal = 'operator-request') {
  const plan = createOrchestrationPlan(goal);
  const evaluated = evaluateQuorum(plan);

  return {
    action: actionName,
    goal,
    accepted: evaluated.overallDecision === 'READY',
    decision: evaluated.overallDecision,
    roles: evaluated.roles,
    failedGates: evaluated.failedGates,
    provider: 'deterministic-local-evidence',
    timestamp: new Date().toISOString()
  };
}

// Example CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = handleLaunchDeskAction(process.argv[2] || 'status', process.argv[3] || 'evolve');
  console.log(JSON.stringify(result, null, 2));
}
