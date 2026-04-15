import { PolicyCheckResult } from './policy.js';
import { SimulationContext } from './simulator.js';

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export function computeRiskScore(
  policyResult: PolicyCheckResult,
  simulation: SimulationContext
): number {
  let score = 0;

  const hardViolations = policyResult.violations.filter((v) => v.severity === 'hard').length;
  const softViolations = policyResult.violations.filter((v) => v.severity === 'soft').length;

  score += hardViolations * 0.35;
  score += softViolations * 0.15;

  if (simulation.expectedSlippageBps && simulation.expectedSlippageBps > 150) {
    score += 0.15;
  } else if (simulation.expectedSlippageBps && simulation.expectedSlippageBps > 100) {
    score += 0.08;
  }

  if (simulation.liquidityUsd !== undefined && simulation.liquidityUsd < 100_000) {
    score += 0.2;
  }

  if (simulation.simulationErrors.length > 0) {
    score += 0.1;
  }

  return Number(clamp01(score).toFixed(4));
}
