import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from 'ethers';
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
  config: AuditorConfig
): Promise<string | undefined> {
  if (!config.responsibilityContractAddress || !config.privateKey || !config.xLayerRpcUrl) {
    return undefined;
  }

  const provider = new JsonRpcProvider(config.xLayerRpcUrl, config.xLayerChainId);
  const signer = new Wallet(config.privateKey, provider);
  const contract = new Contract(config.responsibilityContractAddress, responsibilityAbi, signer);
  const tx = await contract.logDecision(policyHash, intentHash, outcome);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}
