# Build X Moltbook Submission Draft

Use this as a copy-paste base for your submission in `https://www.moltbook.com/m/buildx`.

## Project Name

Agent Governance Auditor

## One-liner

Policy-as-code governance middleware for AI agent actions on OKX Onchain OS with explainable decisions and X Layer accountability logs.

## Problem

Autonomous agents can trigger wallet/trade actions without hard, deterministic governance checks. Teams need a pre-execution control layer that enforces policy and leaves clear accountability evidence.

## Solution

Agent Governance Auditor inspects each intent before execution, applies policy constraints, computes deterministic risk, returns `approved | modified | blocked`, and logs decisions off-chain and on X Layer.

## How It Uses OKX Onchain OS / X Layer

- Agentic Wallet integration path (`ONCHAIN_LOG_SIGNER_MODE=agentic_wallet`) for production-aligned signing flow.
- Trade module via quote API for simulation and execution context.
- Market module via token search and liquidity APIs.
- Wallet/balance module for portfolio context.
- X Layer contract (`ResponsibilityContract`) emits `DecisionLogged` events for tamper-evident accountability.

## Architecture / Flow

Intent input -> parse -> policy checks + simulation -> risk score -> decision -> tx payload + off-chain log + on-chain event.

## Live Proof / Links

- Public repo: `https://github.com/gdev27/agent-governance-auditor`
- Contract: `0x3aEEd5452803123544619A9C0145F268E96e5fA0`
- Deployment tx: `0x4386861b26052da99a8787c3cee3f5db1ca8a2487100058ee4291981e31610b4`
- Contract explorer: `https://www.oklink.com/xlayer-test/address/0x3aEEd5452803123544619A9C0145F268E96e5fA0`
- Deployment tx explorer: `https://www.oklink.com/xlayer-test/tx/0x4386861b26052da99a8787c3cee3f5db1ca8a2487100058ee4291981e31610b4`

## Demo

- CLI command: `npm run demo`
- Output includes decision, explanation, risk score, policy checks, tx payload, audit id, and optional on-chain tx hash.
- Optional 1-3 minute walkthrough video can be attached.

## Team

- Builder: `gdev27`
- GitHub: `https://github.com/gdev27`
- X: `https://x.com/gdev27`
- Telegram: `https://t.me/gdev27`

