import { readFile, writeFile } from 'node:fs/promises';
import { execFile as execFileCallback } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { JsonRpcProvider, Wallet, Contract, Interface, keccak256, toUtf8Bytes } from 'ethers';
import { AuditDecisionResult, CanonicalIntent } from './intent.js';
import { AuditorConfig } from './config.js';
import { GovernancePolicy } from './policy.js';

export interface AuditRecord {
  timestamp: string;
  rawIntent: string | Record<string, unknown>;
  canonicalIntent: CanonicalIntent;
  policyHash: string;
  intentHash: string;
  decision: AuditDecisionResult['decision'];
  riskScore: number;
  txPayload: AuditDecisionResult['txPayload'];
  outcome: number;
  txHash?: string;
  auditId: string;
}

const responsibilityAbi = [
  'function logDecision(bytes32 policyHash, bytes32 intentHash, uint8 outcome) external'
];
const execFile = promisify(execFileCallback);

function defaultAuditPath(): string {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(thisDir, '../data/audit.json');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, v]) => `${JSON.stringify(key)}:${stableStringify(v)}`)
    .join(',')}}`;
}

export function hashPolicy(policy: GovernancePolicy): string {
  return keccak256(toUtf8Bytes(stableStringify(policy)));
}

export function hashIntent(intent: CanonicalIntent): string {
  return keccak256(toUtf8Bytes(stableStringify(intent)));
}

export function buildAuditId(policyHash: string, intentHash: string): string {
  return keccak256(toUtf8Bytes(`${policyHash}:${intentHash}`));
}

export function buildAuditRecord(params: {
  intent: CanonicalIntent;
  decisionResult: AuditDecisionResult;
  policyHash: string;
  intentHash: string;
  onchainTxHash?: string;
}): AuditRecord {
  const outcomeMap = {
    blocked: 0,
    modified: 1,
    approved: 2
  } as const;

  return {
    timestamp: new Date().toISOString(),
    rawIntent: params.intent.rawInput,
    canonicalIntent: params.intent,
    policyHash: params.policyHash,
    intentHash: params.intentHash,
    decision: params.decisionResult.decision,
    riskScore: params.decisionResult.riskScore,
    txPayload: params.decisionResult.txPayload,
    outcome: outcomeMap[params.decisionResult.decision],
    txHash: params.onchainTxHash,
    auditId: params.decisionResult.auditId
  };
}

export async function appendAuditRecord(
  record: AuditRecord,
  auditPath = defaultAuditPath()
): Promise<void> {
  const raw = await readFile(auditPath, 'utf-8').catch(() => '[]');
  const existing = JSON.parse(raw) as AuditRecord[];
  existing.push(record);
  await writeFile(auditPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf-8');
}

export async function logDecisionOnChain(
  policyHash: string,
  intentHash: string,
  outcome: number,
  config: AuditorConfig,
  walletAddress?: string
): Promise<string | undefined> {
  if (!config.responsibilityContractAddress) {
    return undefined;
  }

  if (config.onchainLogSignerMode === 'agentic_wallet') {
    return logDecisionWithAgenticWallet(policyHash, intentHash, outcome, config, walletAddress);
  }

  if (!config.privateKey || !config.xLayerRpcUrl) {
    return undefined;
  }

  const provider = new JsonRpcProvider(config.xLayerRpcUrl, config.xLayerChainId);
  const signer = new Wallet(config.privateKey, provider);
  const contract = new Contract(config.responsibilityContractAddress, responsibilityAbi, signer);
  const tx = await contract.logDecision(policyHash, intentHash, outcome);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

async function logDecisionWithAgenticWallet(
  policyHash: string,
  intentHash: string,
  outcome: number,
  config: AuditorConfig,
  walletAddress?: string
): Promise<string | undefined> {
  const callerWalletAddress = walletAddress ?? config.agenticWalletAddress;
  if (!callerWalletAddress) {
    throw new Error(
      'AGENTIC_WALLET_ADDRESS is required when ONCHAIN_LOG_SIGNER_MODE=agentic_wallet.'
    );
  }

  const iface = new Interface(responsibilityAbi);
  const calldata = iface.encodeFunctionData('logDecision', [policyHash, intentHash, outcome]);
  const args = [
    'wallet',
    'contract-call',
    '--to',
    config.responsibilityContractAddress!,
    '--chain',
    config.agenticWalletChain,
    '--input-data',
    calldata,
    '--from',
    callerWalletAddress
  ];
  const { stdout, stderr } = await execFile(config.agenticWalletCliPath, args, { timeout: 120000 });
  const output = `${stdout ?? ''}\n${stderr ?? ''}`.trim();
  return extractTxHash(output);
}

function extractTxHash(output: string): string | undefined {
  const txHashMatch = output.match(/0x[a-fA-F0-9]{64}/);
  return txHashMatch?.[0];
}
