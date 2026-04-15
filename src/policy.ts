import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CanonicalIntent, PolicyMatch, PolicyViolation } from './intent.js';

export interface SubwalletPolicyOverrides {
  max_trade_usd?: number;
  max_daily_volume_pct?: number;
}

export interface GovernancePolicy {
  version: string;
  risk_thresholds: {
    block: number;
    modify: number;
  };
  caps: {
    max_trade_usd: number;
    max_daily_volume_pct: number;
  };
  allowed_chains: number[];
  allowed_tokens: string[];
  dex_allowlist: string[];
  cooldown_seconds: number;
  max_slippage_bps: number;
  min_liquidity_usd: number;
  subwallet_policies: Record<string, SubwalletPolicyOverrides>;
}

export interface PolicyCheckInput {
  intent: CanonicalIntent;
  portfolioValueUsd: number;
  requestedAmountUsd: number;
  dailyVolumePct: number;
  lastSwapTimestamp?: number;
  nowTs?: number;
}

export interface PolicyCheckResult {
  matches: PolicyMatch[];
  violations: PolicyViolation[];
  effectivePolicy: GovernancePolicy;
}

const tokenAliases: Record<string, string[]> = {
  '0xusdt': ['0x779ded0c9e1022225f8e0630b35a9b54be713736'],
  '0xusdc': ['0x74b7f16337b8972027f6196a17a631ac6de26d22'],
  '0xweth': ['0x5a77f1443d16ee5761d310e38b62f77f726bc71c']
};

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

function buildAllowedTokenSet(allowedTokens: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const token of allowedTokens) {
    const normalized = normalizeToken(token);
    expanded.add(normalized);
    for (const alias of tokenAliases[normalized] ?? []) {
      expanded.add(normalizeToken(alias));
    }
  }
  return expanded;
}

function defaultPolicyPath(): string {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(thisDir, '../data/policy.json');
}

export async function loadPolicy(policyPath = defaultPolicyPath()): Promise<GovernancePolicy> {
  const raw = await readFile(policyPath, 'utf-8');
  return JSON.parse(raw) as GovernancePolicy;
}

function mergeSubwalletPolicy(policy: GovernancePolicy, walletId?: string): GovernancePolicy {
  if (!walletId || !policy.subwallet_policies[walletId]) {
    return policy;
  }

  const overrides = policy.subwallet_policies[walletId];
  return {
    ...policy,
    caps: {
      max_trade_usd: overrides.max_trade_usd ?? policy.caps.max_trade_usd,
      max_daily_volume_pct: overrides.max_daily_volume_pct ?? policy.caps.max_daily_volume_pct
    }
  };
}

export function checkPolicy(input: PolicyCheckInput, policy: GovernancePolicy): PolicyCheckResult {
  const nowTs = input.nowTs ?? Math.floor(Date.now() / 1000);
  const effectivePolicy = mergeSubwalletPolicy(policy, input.intent.conditions.walletId);
  const matches: PolicyMatch[] = [];
  const violations: PolicyViolation[] = [];

  const addMatch = (rule: string, passed: boolean, detail?: string): void => {
    matches.push({ rule, passed, detail });
  };

  const addViolation = (rule: string, severity: 'hard' | 'soft', message: string): void => {
    violations.push({ rule, severity, message });
  };

  const chainAllowed = effectivePolicy.allowed_chains.includes(input.intent.conditions.chainId);
  addMatch('allowed_chains', chainAllowed, `chain=${input.intent.conditions.chainId}`);
  if (!chainAllowed) {
    addViolation('allowed_chains', 'hard', `Chain ${input.intent.conditions.chainId} is not allowed.`);
  }

  const tokenUniverse = [input.intent.sourceToken, input.intent.destinationToken].filter(Boolean) as string[];
  const allowedTokenSet = buildAllowedTokenSet(effectivePolicy.allowed_tokens);
  const disallowed = tokenUniverse.filter((token) => !allowedTokenSet.has(normalizeToken(token)));
  const tokensAllowed = disallowed.length === 0;
  addMatch('allowed_tokens', tokensAllowed, `checked=${tokenUniverse.join(',')}`);
  if (!tokensAllowed) {
    addViolation('allowed_tokens', 'hard', `Disallowed token(s): ${disallowed.join(', ')}`);
  }

  const maxTradeUsd = effectivePolicy.caps.max_trade_usd;
  const withinTradeCap = input.requestedAmountUsd <= maxTradeUsd;
  addMatch('max_trade_usd', withinTradeCap, `${input.requestedAmountUsd} <= ${maxTradeUsd}`);
  if (!withinTradeCap) {
    addViolation(
      'max_trade_usd',
      'hard',
      `Requested notional ${input.requestedAmountUsd} exceeds max trade ${maxTradeUsd}.`
    );
  }

  const withinDailyVolume = input.dailyVolumePct <= effectivePolicy.caps.max_daily_volume_pct;
  addMatch(
    'max_daily_volume_pct',
    withinDailyVolume,
    `${input.dailyVolumePct} <= ${effectivePolicy.caps.max_daily_volume_pct}`
  );
  if (!withinDailyVolume) {
    addViolation(
      'max_daily_volume_pct',
      'soft',
      `Daily volume ratio ${input.dailyVolumePct} exceeds cap ${effectivePolicy.caps.max_daily_volume_pct}.`
    );
  }

  const maxSlippage = effectivePolicy.max_slippage_bps;
  const requestedSlippage = input.intent.conditions.maxSlippageBps ?? maxSlippage;
  const withinSlippage = requestedSlippage <= maxSlippage;
  addMatch('max_slippage_bps', withinSlippage, `${requestedSlippage} <= ${maxSlippage}`);
  if (!withinSlippage) {
    addViolation(
      'max_slippage_bps',
      'soft',
      `Requested slippage ${requestedSlippage} bps exceeds max ${maxSlippage} bps.`
    );
  }

  const withinPortfolioLimit = input.requestedAmountUsd <= input.portfolioValueUsd;
  addMatch(
    'portfolio_balance',
    withinPortfolioLimit,
    `${input.requestedAmountUsd} <= ${input.portfolioValueUsd}`
  );
  if (!withinPortfolioLimit) {
    addViolation(
      'portfolio_balance',
      'hard',
      `Requested amount ${input.requestedAmountUsd} exceeds portfolio value ${input.portfolioValueUsd}.`
    );
  }

  if (input.lastSwapTimestamp) {
    const elapsed = nowTs - input.lastSwapTimestamp;
    const cooldownPass = elapsed >= effectivePolicy.cooldown_seconds;
    addMatch('cooldown_seconds', cooldownPass, `${elapsed} >= ${effectivePolicy.cooldown_seconds}`);
    if (!cooldownPass) {
      addViolation(
        'cooldown_seconds',
        'soft',
        `Swap cooldown not met: ${elapsed}s elapsed, requires ${effectivePolicy.cooldown_seconds}s.`
      );
    }
  } else {
    addMatch('cooldown_seconds', true, 'no prior swap recorded');
  }

  return {
    matches,
    violations,
    effectivePolicy
  };
}
