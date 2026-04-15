import { describe, expect, it } from 'vitest';
import { parseIntent } from '../src/intent.js';

describe('parseIntent', () => {
  it('parses JSON swap intent with fraction amount', async () => {
    const result = await parseIntent(
      {
        action: 'swap',
        sourceToken: 'USDT',
        destinationToken: 'USDC',
        amount: { mode: 'fraction_of_balance', value: '0.5' },
        conditions: { chainId: 1952 }
      },
      {
        defaultChainId: 1952,
        tokenResolver: async (symbol) => `0x${symbol}`
      }
    );

    expect(result.action).toBe('swap');
    expect(result.amount.mode).toBe('fraction_of_balance');
    expect(result.sourceToken).toBe('0xUSDT');
    expect(result.destinationToken).toBe('0xUSDC');
  });

  it('parses NL transfer intent', async () => {
    const result = await parseIntent(
      'transfer 50 usdt to 0x000000000000000000000000000000000000dEaD',
      {
        defaultChainId: 1952
      }
    );

    expect(result.action).toBe('transfer');
    expect(result.amount.value).toBe('50');
    expect(result.recipient).toBe('0x000000000000000000000000000000000000dEaD');
  });

  it('fails when token resolution fails', async () => {
    await expect(
      parseIntent(
        {
          action: 'swap',
          sourceToken: 'UNKNOWN',
          destinationToken: 'USDC',
          amount: { mode: 'absolute', value: '10' },
          conditions: { chainId: 1952 }
        },
        {
          defaultChainId: 1952,
          tokenResolver: async (symbol) => {
            if (symbol === 'UNKNOWN') {
              throw new Error('not found');
            }
            return `0x${symbol}`;
          }
        }
      )
    ).rejects.toThrow('not found');
  });
});
