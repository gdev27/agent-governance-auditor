import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendAuditRecord,
  buildAuditId,
  buildAuditRecord,
  hashIntent,
  hashPolicy,
  logDecisionOnChain
} from '../src/auditLogger.js';

describe('auditLogger', () => {
  it('hashes and audit id are deterministic', () => {
    const policy = {
      version: '1',
      risk_thresholds: { block: 0.8, modify: 0.5 },
      caps: { max_trade_usd: 1, max_daily_volume_pct: 0.1 },
      allowed_chains: [1952],
      allowed_tokens: ['0xUSDT'],
      dex_allowlist: ['okx-dex-swap'],
      cooldown_seconds: 120,
      max_slippage_bps: 150,
      min_liquidity_usd: 100_000,
      subwallet_policies: {}
    };
    const intent = {
      action: 'transfer' as const,
      sourceToken: '0xUSDT',
      recipient: '0x000000000000000000000000000000000000dEaD',
      amount: { mode: 'absolute' as const, value: '1' },
      conditions: { chainId: 1952 },
      rawInput: {}
    };

    const policyHash1 = hashPolicy(policy as never);
    const policyHash2 = hashPolicy(policy as never);
    const intentHash1 = hashIntent(intent);
    const intentHash2 = hashIntent(intent);
    const auditId1 = buildAuditId(policyHash1, intentHash1);
    const auditId2 = buildAuditId(policyHash2, intentHash2);

    expect(policyHash1).toBe(policyHash2);
    expect(intentHash1).toBe(intentHash2);
    expect(auditId1).toBe(auditId2);
  });

  it('appends records to audit json', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'aga-audit-'));
    const auditPath = path.join(dir, 'audit.json');
    await writeFile(auditPath, '[]', 'utf-8');

    const record = buildAuditRecord({
      intent: {
        action: 'transfer',
        sourceToken: '0xUSDT',
        recipient: '0x000000000000000000000000000000000000dEaD',
        amount: { mode: 'absolute', value: '1' },
        conditions: { chainId: 1952 },
        rawInput: {}
      },
      decisionResult: {
        decision: 'approved',
        explanation: 'ok',
        riskScore: 0.1,
        policyMatches: [],
        violations: [],
        txPayload: null,
        auditId: '0xaudit'
      },
      policyHash: '0xpolicy',
      intentHash: '0xintent'
    });

    await appendAuditRecord(record, auditPath);
    const raw = await readFile(auditPath, 'utf-8');
    const parsed = JSON.parse(raw) as Array<{ auditId: string }>;

    expect(parsed).toHaveLength(1);
    expect(parsed[0].auditId).toBe('0xaudit');
  });

  it('skips onchain logging when contract address is missing', async () => {
    const txHash = await logDecisionOnChain('0xpolicy', '0xintent', 2, {
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
    });
    expect(txHash).toBeUndefined();
  });

  it('requires a wallet address for agentic wallet mode', async () => {
    await expect(
      logDecisionOnChain(
        '0xpolicy',
        '0xintent',
        2,
        {
          okxApiKey: '',
          okxSecretKey: '',
          okxPassphrase: '',
          onchainOsBaseUrl: '',
          xLayerRpcUrl: '',
          xLayerChainId: 1952,
          xLayerMainnetChainId: 196,
          responsibilityContractAddress: '0x0000000000000000000000000000000000000001',
          onchainLogSignerMode: 'agentic_wallet',
          agenticWalletCliPath: 'onchainos',
          agenticWalletChain: 'xlayer',
          defaultSlippageBps: 100
        },
        undefined
      )
    ).rejects.toThrow('AGENTIC_WALLET_ADDRESS is required');
  });
});
