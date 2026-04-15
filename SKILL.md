---
name: okx-agent-governance-auditor
description: Audit OKX Onchain OS trade and wallet intents with policy checks, risk simulation, explainable decisions, and onchain accountability logging. Use when an agent proposes swap/transfer actions and governance validation is required before execution.
version: 1.0.0
required_context:
  - OKX_API_KEY
  - OKX_SECRET_KEY
  - OKX_PASSPHRASE
  - X_LAYER_RPC_URL
  - X_LAYER_CHAIN_ID
  - RESPONSIBILITY_CONTRACT_ADDRESS
---

# OKX Agent Governance Auditor

## Purpose

Enforce team governance policy between agent intent and execution by:

1. Parsing intent to canonical shape
2. Evaluating policy rules
3. Simulating market/wallet context
4. Computing deterministic risk score
5. Returning normalized audit result
6. Logging off-chain and optionally on-chain

## Input

- `intent`: JSON object or JSON string, or supported NL phrase (`swap ...`, `transfer ...`)
- Optional:
  - `walletAddress`
  - `dailyVolumePct`

## Output Schema (`AuditDecisionResult`)

```json
{
  "decision": "approved | modified | blocked",
  "explanation": "string",
  "riskScore": 0.0,
  "policyMatches": [{ "rule": "string", "passed": true, "detail": "string" }],
  "violations": [{ "rule": "string", "severity": "hard | soft", "message": "string" }],
  "modifications": ["string"],
  "txPayload": { "route": "okx-dex-swap | okx-agentic-wallet", "request": {} },
  "auditId": "0x...",
  "onchainTxHash": "0x..."
}
```

## Example

Input:

```json
{
  "action": "swap",
  "sourceToken": "USDT",
  "destinationToken": "USDC",
  "amount": { "mode": "absolute", "value": "250" },
  "conditions": { "chainId": 1952, "maxSlippageBps": 90 }
}
```

Possible output:

```json
{
  "decision": "approved",
  "explanation": "Decision: approved. Risk score: 0.",
  "riskScore": 0,
  "policyMatches": [],
  "violations": [],
  "txPayload": {
    "route": "okx-dex-swap",
    "request": {
      "chainId": 1952,
      "fromTokenAddress": "0xUSDT",
      "toTokenAddress": "0xUSDC",
      "amount": "250",
      "slippageBps": 90
    }
  },
  "auditId": "0x...",
  "onchainTxHash": "0x..."
}
```
