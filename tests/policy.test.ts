import { describe, expect, it } from 'vitest';
import { checkPolicy, loadPolicy } from '../src/policy.js';
import { CanonicalIntent } from '../src/intent.js';

describe('policy checks', () => {
  const baseIntent: CanonicalIntent = {
    action: 'swap',
    sourceToken: '0xUSDT',
    destinationToken: '0xUSDC',
    amount: { mode: 'absolute', value: '100' },
    conditions: { chainId: 1952 },
    rawInput: {}
  };

  it('passes baseline policy checks', async () => {
    const policy = await loadPolicy();
    const result = checkPolicy(
      {
        intent: baseIntent,
        portfolioValueUsd: 100000,
        requestedAmountUsd: 100,
        dailyVolumePct: 0.05,
        lastSwapTimestamp: 1000,
        nowTs: 2000
      },
      policy
    );

    expect(result.violations.length).toBe(0);
    expect(result.matches.every((m) => m.passed)).toBe(true);
  });

  it('returns hard violation for disallowed chain', async () => {
    const policy = await loadPolicy();
    const result = checkPolicy(
      {
        intent: { ...baseIntent, conditions: { chainId: 196 } },
        portfolioValueUsd: 100000,
        requestedAmountUsd: 100,
        dailyVolumePct: 0.05
      },
      policy
    );

    expect(result.violations.some((v) => v.rule === 'allowed_chains' && v.severity === 'hard')).toBe(true);
  });

  it('applies treasury subwallet override', async () => {
    const policy = await loadPolicy();
    const result = checkPolicy(
      {
        intent: { ...baseIntent, conditions: { chainId: 1952, walletId: 'treasury' } },
        portfolioValueUsd: 100000,
        requestedAmountUsd: 15000,
        dailyVolumePct: 0.05
      },
      policy
    );

    expect(result.violations.some((v) => v.rule === 'max_trade_usd')).toBe(true);
  });
});
