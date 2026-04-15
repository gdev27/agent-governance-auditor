import { getConfig, AuditorConfig } from './config.js';
import { MarketClient } from './clients/marketClient.js';
import { TradeClient } from './clients/tradeClient.js';
import { WalletClient } from './clients/walletClient.js';
import { AuditDecisionResult, CanonicalIntent, GovernanceDecision, TxPayload } from './intent.js';
import { GovernancePolicy, checkPolicy, loadPolicy } from './policy.js';
import { SimulatorDeps, simulateTx } from './simulator.js';
import { computeRiskScore } from './risk.js';
import {
  appendAuditRecord,
  buildAuditId,
  buildAuditRecord,
  hashIntent,
  hashPolicy,
  logDecisionOnChain
} from './auditLogger.js';

export interface AuditIntentOptions {
  walletAddress: string;
  dailyVolumePct?: number;
  policyPath?: string;
  auditPath?: string;
}

export interface DeciderDeps extends SimulatorDeps {
  config: AuditorConfig;
}

function buildDefaultDeps(config = getConfig()): DeciderDeps {
  return {
    config,
    walletClient: new WalletClient(config),
    tradeClient: new TradeClient(config),
    marketClient: new MarketClient(config)
  };
}

function resolveAmountIn(intent: CanonicalIntent, balances: Record<string, string>): string {
  if (intent.amount.mode === 'absolute') {
    return intent.amount.value;
  }

  const sourceBalance = intent.sourceToken ? Number(balances[intent.sourceToken] ?? 0) : 0;
  const fraction = Number(intent.amount.value);
  const amount = sourceBalance * fraction;
  return amount.toFixed(8);
}

function decide(
  riskScore: number,
  hardViolations: number,
  softViolations: number,
  policy: GovernancePolicy
): GovernanceDecision {
  if (hardViolations > 0 || riskScore >= policy.risk_thresholds.block) {
    return 'blocked';
  }
  if (softViolations > 0 || riskScore >= policy.risk_thresholds.modify) {
    return 'modified';
  }
  return 'approved';
}

function buildTxPayload(
  intent: CanonicalIntent,
  amountIn: string,
  decision: GovernanceDecision,
  policy: GovernancePolicy,
  options: AuditIntentOptions,
  deps: DeciderDeps
): TxPayload | null {
  if (decision === 'blocked') {
    return null;
  }

  if (intent.action === 'swap' && intent.sourceToken && intent.destinationToken) {
    const maxSlippageBps = Math.min(
      intent.conditions.maxSlippageBps ?? policy.max_slippage_bps,
      policy.max_slippage_bps
    );

    return {
      route: 'okx-dex-swap',
      request: deps.tradeClient.buildSwapRequest({
        tokenIn: intent.sourceToken,
        tokenOut: intent.destinationToken,
        amountIn,
        maxSlippageBps,
        chainId: intent.conditions.chainId,
        walletAddress: options.walletAddress
      })
    };
  }

  if (intent.action === 'transfer' && intent.sourceToken && intent.recipient) {
    return {
      route: 'okx-agentic-wallet',
      request: {
        chainId: intent.conditions.chainId,
        tokenAddress: intent.sourceToken,
        amount: amountIn,
        recipient: intent.recipient,
        walletAddress: options.walletAddress
      }
    };
  }

  return null;
}

export async function auditIntent(
  intent: CanonicalIntent,
  options: AuditIntentOptions,
  deps = buildDefaultDeps()
): Promise<AuditDecisionResult> {
  const policy = await loadPolicy(options.policyPath);
  const walletState = await deps.walletClient.getWalletState(options.walletAddress);
  const amountIn = resolveAmountIn(intent, walletState.balances);
  const requestedAmountUsd = Number(amountIn);
  const dailyVolumePct = options.dailyVolumePct ?? 0;

  const policyResult = checkPolicy(
    {
      intent,
      portfolioValueUsd: walletState.portfolioValueUsd,
      requestedAmountUsd,
      dailyVolumePct,
      lastSwapTimestamp: walletState.lastSwapTimestamp
    },
    policy
  );

  const simulation = await simulateTx(intent, options.walletAddress, amountIn, deps);
  const riskScore = computeRiskScore(policyResult, simulation);
  const hardViolations = policyResult.violations.filter((v) => v.severity === 'hard').length;
  const softViolations = policyResult.violations.filter((v) => v.severity === 'soft').length;
  const decision = decide(riskScore, hardViolations, softViolations, policyResult.effectivePolicy);

  const txPayload = buildTxPayload(intent, amountIn, decision, policyResult.effectivePolicy, options, deps);
  const policyHash = hashPolicy(policyResult.effectivePolicy);
  const intentHash = hashIntent(intent);
  const auditId = buildAuditId(policyHash, intentHash);
  const modifications: string[] = [];

  if (decision === 'modified') {
    const requestedSlippage = intent.conditions.maxSlippageBps ?? policyResult.effectivePolicy.max_slippage_bps;
    if (requestedSlippage > policyResult.effectivePolicy.max_slippage_bps) {
      modifications.push(
        `Slippage capped from ${requestedSlippage}bps to ${policyResult.effectivePolicy.max_slippage_bps}bps`
      );
    }
  }

  const explanation = [
    `Decision: ${decision}.`,
    `Risk score: ${riskScore}.`,
    policyResult.violations.length
      ? `Violations: ${policyResult.violations.map((v) => v.rule).join(', ')}.`
      : 'No policy violations found.',
    simulation.simulationErrors.length
      ? `Simulation notes: ${simulation.simulationErrors.join(' | ')}.`
      : 'Simulation completed without errors.'
  ].join(' ');

  const outcomeMap = { blocked: 0, modified: 1, approved: 2 } as const;
  const onchainTxHash = await logDecisionOnChain(policyHash, intentHash, outcomeMap[decision], deps.config);

  const decisionResult: AuditDecisionResult = {
    decision,
    explanation,
    riskScore,
    policyMatches: policyResult.matches,
    violations: policyResult.violations,
    modifications: modifications.length > 0 ? modifications : undefined,
    txPayload,
    auditId,
    onchainTxHash
  };

  const auditRecord = buildAuditRecord({
    intent,
    decisionResult,
    policyHash,
    intentHash,
    onchainTxHash
  });
  await appendAuditRecord(auditRecord, options.auditPath);

  return decisionResult;
}
