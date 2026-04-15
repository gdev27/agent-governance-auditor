# Build X Submission Checklist

## Required links

- Moltbook submolt: `https://www.moltbook.com/m/buildx`
- Public repo: `https://github.com/gdev27/agent-governance-auditor`
- X Layer contract: `0x3aEEd5452803123544619A9C0145F268E96e5fA0`
- Deployment tx: `0x4386861b26052da99a8787c3cee3f5db1ca8a2487100058ee4291981e31610b4`

## Judges will see

1. Moltbook submission post in `m/buildx` using required template fields.
2. Public GitHub README with architecture, deployment proof, team, Onchain OS usage, and X Layer positioning.
3. On-chain contract and tx proof on X Layer testnet explorer.
4. CLI demo output with `AuditDecisionResult` and DecisionLogged explorer tx.

## Build X requirement mapping

- Agentic Wallet integration:
  - implemented signer abstraction with `ONCHAIN_LOG_SIGNER_MODE=agentic_wallet` support.
  - local fallback: `private_key`.
- Onchain OS modules used:
  - Wallet/balance APIs
  - Trade quote API
  - Market token/liquidity APIs
- X Layer ecosystem:
  - contract deployed on testnet `1952`.
  - architecture remains portable to mainnet `196`.

## Recommended extras (not mandatory)

- 1-3 minute demo video.
- X post with `@XLayerOfficial` and `#BuildX`.

## Final pre-submit checks

- `.env` is not committed.
- README contract address and tx links are correct.
- Moltbook post includes contact field (email/Telegram).
- Vote on 5+ projects to keep prize eligibility.
