/**
 * LaunchDesk action bridge
 * Named actions + generic fallback.
 * All actions are evaluated through the five-role orchestration layer.
 */

import { createOrchestrationPlan, evaluateQuorum } from '../agents/orchestration.mjs';

const NAMED_ACTIONS = {
  status: 'Report current plane and readiness state',
  evolve: 'Advance the system one controlled step',
  pause: 'Hold further automatic progress',
  procure: 'Evaluate whether the next stage may be procured',
  resume: 'Clear a previous pause and continue'
};

export function listNamedActions() {
  return Object.entries(NAMED_ACTIONS).map(([name, description]) => ({ name, description }));
}

export function handleLaunchDeskAction(actionName = 'status', goal = 'operator-request') {
  const plan = createOrchestrationPlan(goal);
  const evaluated = evaluateQuorum(plan);
  const known = Boolean(NAMED_ACTIONS[actionName]);

  return {
    action: actionName,
    knownAction: known,
    description: NAMED_ACTIONS[actionName] || 'Generic operator request',
    goal,
    accepted: evaluated.overallDecision === 'READY',
    decision: evaluated.overallDecision,
    roles: evaluated.roles,
    failedGates: evaluated.failedGates,
    provider: 'deterministic-local-evidence',
    timestamp: new Date().toISOString()
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2] || 'status';
  if (action === 'list') {
    console.log(JSON.stringify(listNamedActions(), null, 2));
  } else {
    const result = handleLaunchDeskAction(action, process.argv[3] || 'evolve');
    console.log(JSON.stringify(result, null, 2));
  }
}
