---
name: okx-agent-governance-auditor
description: "Use this skill when an agent proposes a wallet or trade action and you need pre-execution governance controls, deterministic risk scoring, explainable approved/modified/blocked decisions, and optional X Layer on-chain accountability logs."
license: MIT
metadata:
  author: gdev27
  version: "1.1.0"
  homepage: "https://github.com/gdev27/agent-governance-auditor"
required_context:
  - OKX_API_KEY
  - OKX_SECRET_KEY
  - OKX_PASSPHRASE
  - X_LAYER_RPC_URL
  - X_LAYER_CHAIN_ID
  - RESPONSIBILITY_CONTRACT_ADDRESS
  - ONCHAIN_LOG_SIGNER_MODE
---

# OKX Agent Governance Auditor

Governance guardrail skill for Onchain OS-powered agents.

## When to use

Use this skill when:
- a swap or transfer intent must be checked against policy before execution
- your agent needs deterministic risk scoring and explainable output
- you need off-chain + optional on-chain decision logging

## Governance pipeline

Enforce team governance policy between agent intent and execution by:

1. Parsing intent to canonical shape
2. Evaluating policy rules
3. Simulating market/wallet context
4. Computing deterministic risk score
5. Returning normalized audit result
6. Logging off-chain and optionally on-chain

## Inputs

- `intent`: JSON object or JSON string, or supported NL phrase (`swap ...`, `transfer ...`)
- Optional:
  - `walletAddress`
  - `dailyVolumePct`
  - `policyPath`
  - `auditPath`

## Output schema (`AuditDecisionResult`)

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

## Signing modes for on-chain logs

- `ONCHAIN_LOG_SIGNER_MODE=private_key`
  - local/dev fallback via ethers signer.
- `ONCHAIN_LOG_SIGNER_MODE=agentic_wallet`
  - production-aligned path via Agentic Wallet (`onchainos wallet contract-call`) for `ResponsibilityContract.logDecision(...)`.

## MCP tool mapping

- Tool name: `governance_audit`
- Input: `{ intent, walletAddress?, dailyVolumePct? }`
- Output: `AuditDecisionResult`

## Example request

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

## Example response

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
