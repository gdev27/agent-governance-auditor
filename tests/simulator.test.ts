import { describe, expect, it } from 'vitest';
import { simulateTx } from '../src/simulator.js';
import { CanonicalIntent } from '../src/intent.js';

describe('simulateTx', () => {
  const intent: CanonicalIntent = {
    action: 'swap',
    sourceToken: '0xUSDT',
    destinationToken: '0xUSDC',
    amount: { mode: 'absolute', value: '100' },
    conditions: { chainId: 1952 },
    rawInput: {}
  };

  it('returns quote and liquidity on healthy path', async () => {
    const result = await simulateTx(intent, '0xwallet', '100', {
      walletClient: {} as never,
      tradeClient: {
        getSwapQuote: async () => ({
          tokenIn: '0xUSDT',
          tokenOut: '0xUSDC',
          amountIn: '100',
          expectedAmountOut: '99',
          estimatedSlippageBps: 70
        })
      } as never,
      marketClient: {
        getLiquidity: async () => ({ pair: '0xUSDT:0xUSDC', liquidityUsd: 2_000_000 })
      } as never
    });

    expect(result.quote?.expectedAmountOut).toBe('99');
    expect(result.liquidityUsd).toBe(2_000_000);
    expect(result.simulationErrors).toHaveLength(0);
  });

  it('soft-fails when quote and liquidity calls fail', async () => {
    const result = await simulateTx(intent, '0xwallet', '100', {
      walletClient: {} as never,
      tradeClient: {
        getSwapQuote: async () => {
          throw new Error('quote down');
        }
      } as never,
      marketClient: {
        getLiquidity: async () => {
          throw new Error('liq down');
        }
      } as never
    });

    expect(result.simulationErrors.length).toBe(2);
    expect(result.quote).toBeUndefined();
  });
});
