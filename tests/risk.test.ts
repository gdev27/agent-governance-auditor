import { describe, expect, it } from 'vitest';
import { computeRiskScore } from '../src/risk.js';

describe('computeRiskScore', () => {
  it('returns low risk for healthy simulation', () => {
    const score = computeRiskScore(
      {
        matches: [],
        violations: [],
        effectivePolicy: {} as never
      },
      {
        walletAddress: '0x',
        amountIn: '100',
        expectedSlippageBps: 60,
        liquidityUsd: 2_000_000,
        simulationErrors: []
      }
    );

    expect(score).toBe(0);
  });

  it('returns high risk for hard violations and bad simulation', () => {
    const score = computeRiskScore(
      {
        matches: [],
        violations: [
          { rule: 'allowed_chains', severity: 'hard', message: 'bad chain' },
          { rule: 'max_trade_usd', severity: 'hard', message: 'cap exceeded' }
        ],
        effectivePolicy: {} as never
      },
      {
        walletAddress: '0x',
        amountIn: '100',
        expectedSlippageBps: 250,
        liquidityUsd: 50_000,
        simulationErrors: ['quote failed']
      }
    );

    expect(score).toBeGreaterThanOrEqual(0.8);
  });
});
