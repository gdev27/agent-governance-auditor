import { z } from 'zod';

export type CanonicalAction = 'swap' | 'transfer';
export type GovernanceDecision = 'approved' | 'modified' | 'blocked';
export type AmountMode = 'absolute' | 'fraction_of_balance';

export interface CanonicalIntentAmount {
  mode: AmountMode;
  value: string;
}

export interface CanonicalIntentConditions {
  chainId: number;
  walletId?: string;
  maxSlippageBps?: number;
  deadlineSeconds?: number;
}

export interface CanonicalIntent {
  action: CanonicalAction;
  sourceToken?: string;
  destinationToken?: string;
  recipient?: string;
  amount: CanonicalIntentAmount;
  conditions: CanonicalIntentConditions;
  rawInput: string | Record<string, unknown>;
}

export interface PolicyMatch {
  rule: string;
  passed: boolean;
  detail?: string;
}

export interface PolicyViolation {
  rule: string;
  severity: 'hard' | 'soft';
  message: string;
}

export interface TxPayload {
  route: 'okx-dex-swap' | 'okx-agentic-wallet';
  request: Record<string, unknown>;
}

export interface AuditDecisionResult {
  decision: GovernanceDecision;
  explanation: string;
  riskScore: number;
  policyMatches: PolicyMatch[];
  violations: PolicyViolation[];
  modifications?: string[];
  txPayload: TxPayload | null;
  auditId: string;
  onchainTxHash?: string;
}

export interface ParseIntentOptions {
  defaultChainId: number;
  tokenResolver?: (symbolOrAddress: string) => Promise<string>;
}

const amountSchema = z.object({
  mode: z.enum(['absolute', 'fraction_of_balance']),
  value: z.string().min(1)
});

const canonicalIntentInputSchema = z.object({
  action: z.enum(['swap', 'transfer']),
  sourceToken: z.string().optional(),
  destinationToken: z.string().optional(),
  recipient: z.string().optional(),
  amount: amountSchema,
  conditions: z
    .object({
      chainId: z.number().int().positive().optional(),
      walletId: z.string().optional(),
      maxSlippageBps: z.number().int().positive().optional(),
      deadlineSeconds: z.number().int().positive().optional()
    })
    .optional()
});

function parseNaturalLanguage(input: string, defaultChainId: number): CanonicalIntent {
  const swapRegex = /swap\s+([0-9]*\.?[0-9]+|all)\s+([A-Za-z0-9]+)\s+(?:to|for)\s+([A-Za-z0-9]+)/i;
  const transferRegex =
    /transfer\s+([0-9]*\.?[0-9]+|all)\s+([A-Za-z0-9]+)\s+to\s+(0x[a-fA-F0-9]{40})/i;

  const swapMatch = input.match(swapRegex);
  if (swapMatch) {
    const amountValue = swapMatch[1].toLowerCase() === 'all' ? '1' : swapMatch[1];
    const amountMode = swapMatch[1].toLowerCase() === 'all' ? 'fraction_of_balance' : 'absolute';
    return {
      action: 'swap',
      sourceToken: swapMatch[2].toUpperCase(),
      destinationToken: swapMatch[3].toUpperCase(),
      amount: { mode: amountMode, value: amountValue },
      conditions: { chainId: defaultChainId },
      rawInput: input
    };
  }

  const transferMatch = input.match(transferRegex);
  if (transferMatch) {
    const amountValue = transferMatch[1].toLowerCase() === 'all' ? '1' : transferMatch[1];
    const amountMode = transferMatch[1].toLowerCase() === 'all' ? 'fraction_of_balance' : 'absolute';
    return {
      action: 'transfer',
      sourceToken: transferMatch[2].toUpperCase(),
      recipient: transferMatch[3],
      amount: { mode: amountMode, value: amountValue },
      conditions: { chainId: defaultChainId },
      rawInput: input
    };
  }

  throw new Error('Unable to parse natural language intent. Provide JSON or a supported phrase.');
}

async function normalizeToken(
  token: string | undefined,
  resolver?: (symbolOrAddress: string) => Promise<string>
): Promise<string | undefined> {
  if (!token) {
    return undefined;
  }
  if (token.startsWith('0x')) {
    return token;
  }
  if (!resolver) {
    return token.toUpperCase();
  }
  return resolver(token);
}

function validateActionFields(intent: CanonicalIntent): void {
  if (intent.action === 'swap' && (!intent.sourceToken || !intent.destinationToken)) {
    throw new Error('Swap intents require sourceToken and destinationToken.');
  }
  if (intent.action === 'transfer' && (!intent.sourceToken || !intent.recipient)) {
    throw new Error('Transfer intents require sourceToken and recipient.');
  }
}

export async function parseIntent(
  input: string | Record<string, unknown>,
  options: ParseIntentOptions
): Promise<CanonicalIntent> {
  const normalizedInput =
    typeof input === 'string'
      ? (() => {
          try {
            return JSON.parse(input) as Record<string, unknown>;
          } catch {
            return parseNaturalLanguage(input, options.defaultChainId);
          }
        })()
      : input;

  const parsed = canonicalIntentInputSchema.parse(normalizedInput);
  const canonicalIntent: CanonicalIntent = {
    action: parsed.action,
    sourceToken: await normalizeToken(parsed.sourceToken, options.tokenResolver),
    destinationToken: await normalizeToken(parsed.destinationToken, options.tokenResolver),
    recipient: parsed.recipient,
    amount: parsed.amount,
    conditions: {
      chainId: parsed.conditions?.chainId ?? options.defaultChainId,
      walletId: parsed.conditions?.walletId,
      maxSlippageBps: parsed.conditions?.maxSlippageBps,
      deadlineSeconds: parsed.conditions?.deadlineSeconds
    },
    rawInput: input
  };

  validateActionFields(canonicalIntent);
  return canonicalIntent;
}
