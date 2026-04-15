import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditIntent } from '../src/decider.js';
import { CanonicalIntent } from '../src/intent.js';

async function setupPolicyFile(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aga-policy-'));
  const policyPath = path.join(dir, 'policy.json');
  await writeFile(
    policyPath,
    JSON.stringify({
      version: '1.0.0',
      risk_thresholds: { block: 0.8, modify: 0.5 },
      caps: { max_trade_usd: 25000, max_daily_volume_pct: 0.35 },
      allowed_chains: [1952],
      allowed_tokens: ['0xUSDT', '0xUSDC'],
      dex_allowlist: ['okx-dex-swap'],
      cooldown_seconds: 120,
      max_slippage_bps: 150,
      min_liquidity_usd: 100000,
      subwallet_policies: {}
    }),
    'utf-8'
  );
  return policyPath;
}

describe('auditIntent', () => {
  const intent: CanonicalIntent = {
    action: 'swap',
    sourceToken: '0xUSDT',
    destinationToken: '0xUSDC',
    amount: { mode: 'absolute', value: '100' },
    conditions: { chainId: 1952, maxSlippageBps: 50 },
    rawInput: {}
  };

  it('approves healthy intent and returns stable output fields', async () => {
    const policyPath = await setupPolicyFile();
    const auditPath = path.join(path.dirname(policyPath), 'audit.json');
    await writeFile(auditPath, '[]', 'utf-8');

    const deps = {
      config: {
        okxApiKey: '',
        okxSecretKey: '',
        okxPassphrase: '',
        onchainOsBaseUrl: '',
        xLayerRpcUrl: '',
        xLayerChainId: 1952,
        xLayerMainnetChainId: 196,
        onchainLogSignerMode: 'private_key',
        agenticWalletCliPath: 'onchainos',
        agenticWalletChain: 'xlayer',
        defaultSlippageBps: 100
      },
      walletClient: {
        getWalletState: async () => ({
          address: '0xwallet',
          portfolioValueUsd: 10_000,
          balances: { '0xUSDT': '1000' },
          lastSwapTimestamp: 0
        })
      },
      tradeClient: {
        getSwapQuote: async () => ({
          tokenIn: '0xUSDT',
          tokenOut: '0xUSDC',
          amountIn: '100',
          expectedAmountOut: '99',
          estimatedSlippageBps: 40
        }),
        buildSwapRequest: () => ({ route: 'swap' })
      },
      marketClient: {
        getLiquidity: async () => ({ pair: '0xUSDT:0xUSDC', liquidityUsd: 2_000_000 })
      }
    };

    const result1 = await auditIntent(
      intent,
      { walletAddress: '0xwallet', policyPath, auditPath, dailyVolumePct: 0.05 },
      deps as never
    );
    const result2 = await auditIntent(
      intent,
      { walletAddress: '0xwallet', policyPath, auditPath, dailyVolumePct: 0.05 },
      deps as never
    );

    expect(result1.decision).toBe('approved');
    expect(result1.txPayload).not.toBeNull();
    expect(result1.auditId).toBe(result2.auditId);
  });

  it('blocks on hard violations', async () => {
    const policyPath = await setupPolicyFile();
    const auditPath = path.join(path.dirname(policyPath), 'audit.json');
    await writeFile(auditPath, '[]', 'utf-8');

    const deps = {
      config: {
        okxApiKey: '',
        okxSecretKey: '',
        okxPassphrase: '',
        onchainOsBaseUrl: '',
        xLayerRpcUrl: '',
        xLayerChainId: 1952,
        xLayerMainnetChainId: 196,
        onchainLogSignerMode: 'private_key',
        agenticWalletCliPath: 'onchainos',
        agenticWalletChain: 'xlayer',
        defaultSlippageBps: 100
      },
      walletClient: {
        getWalletState: async () => ({
          address: '0xwallet',
          portfolioValueUsd: 500,
          balances: { '0xUSDT': '1000' },
          lastSwapTimestamp: 0
        })
      },
      tradeClient: {
        getSwapQuote: async () => ({
          tokenIn: '0xUSDT',
          tokenOut: '0xUSDC',
          amountIn: '1000',
          expectedAmountOut: '980',
          estimatedSlippageBps: 180
        }),
        buildSwapRequest: () => ({})
      },
      marketClient: {
        getLiquidity: async () => ({ pair: '0xUSDT:0xUSDC', liquidityUsd: 10_000 })
      }
    };

    const result = await auditIntent(
      { ...intent, amount: { mode: 'absolute', value: '1000' } },
      { walletAddress: '0xwallet', policyPath, auditPath, dailyVolumePct: 0.9 },
      deps as never
    );

    expect(result.decision).toBe('blocked');
    expect(result.txPayload).toBeNull();
  });

  it('returns a decision when onchain logging fails', async () => {
    const policyPath = await setupPolicyFile();
    const auditPath = path.join(path.dirname(policyPath), 'audit.json');
    await writeFile(auditPath, '[]', 'utf-8');

    const deps = {
      config: {
        okxApiKey: '',
        okxSecretKey: '',
        okxPassphrase: '',
        onchainOsBaseUrl: '',
        xLayerRpcUrl: '',
        xLayerChainId: 1952,
        xLayerMainnetChainId: 196,
        responsibilityContractAddress: '0x0000000000000000000000000000000000000001',
        onchainLogSignerMode: 'agentic_wallet',
        agenticWalletCliPath: 'non-existent-onchainos-cli',
        agenticWalletChain: 'xlayer',
        agenticWalletAddress: '0x0000000000000000000000000000000000000002',
        defaultSlippageBps: 100
      },
      walletClient: {
        getWalletState: async () => ({
          address: '0xwallet',
          portfolioValueUsd: 10_000,
          balances: { '0xUSDT': '1000' },
          lastSwapTimestamp: 0
        })
      },
      tradeClient: {
        getSwapQuote: async () => ({
          tokenIn: '0xUSDT',
          tokenOut: '0xUSDC',
          amountIn: '100',
          expectedAmountOut: '99',
          estimatedSlippageBps: 40
        }),
        buildSwapRequest: () => ({ route: 'swap' })
      },
      marketClient: {
        getLiquidity: async () => ({ pair: '0xUSDT:0xUSDC', liquidityUsd: 2_000_000 })
      }
    };

    const result = await auditIntent(
      intent,
      { walletAddress: '0xwallet', policyPath, auditPath, dailyVolumePct: 0.05 },
      deps as never
    );

    expect(result.decision).toBe('approved');
    expect(result.onchainTxHash).toBeUndefined();
    expect(result.explanation).toContain('On-chain logging unavailable');
  });
});
