# Leash

A spending account for AI agents on Solana. The agent holds a USDC wallet and pays for data through x402, the HTTP 402 payment standard. The owner sets the rules, and every payment is checked against them before it is signed. The agent never touches the wallet key, and each payment attempt, allowed or blocked, goes on a statement the owner can read.

Built for the UBC 2026 Hackathon, Track 1 (Agentic Payments & AI), Solana chain award. Everything runs on Solana devnet with test USDC.

## The problem

An agent that can pay for things needs a wallet. Handing it a funded wallet means trusting the model with all of it: a prompt injection, a retry loop or a bad plan can drain it. People handle this with employees using a company card that has limits, a merchant list and a statement. Agents have nothing like that yet.

## What it does

- **Rules the owner controls:** a per-purchase cap, a daily cap, a per-merchant cap, an expiry date and a merchant allowlist.
- **Pause switch:** one click stops all spending, and the next payment is refused.
- **Payee check:** if a merchant's 402 response asks to be paid at a wallet other than the one on file, the payment is refused.
- **Approval requests:** when a purchase is blocked and the agent still thinks it needs it, it files a request for the owner instead of retrying. The owner can approve it from the statement, which pays once above the caps (pause, expiry, allowlist and payee checks still apply), or deny it.
- **Statement:** every attempt is recorded with the amount, the reason the agent gave, the rule that blocked it (if any) and a Solana explorer link for settled payments.

## How it works

```
                 task
  Owner  ───────────────────►  Agent (Claude Haiku, or scripted planner)
    │                               │  tools: list_merchants, pay_and_fetch,
    │ rules, pause,                 │         request_approval
    │ allowlist                     ▼
    │                      ┌─────────────────────┐
    └─────────────────────►│  Policy engine      │  runs in the x402 client's
                           │  (src/lib/policy)   │  onBeforePaymentCreation hook
                           └──────────┬──────────┘
                              allow   │   block → receipt with rule, no signature
                                      ▼
                           x402 client signs a USDC transfer
                           with the agent wallet (server only)
                                      │  X-PAYMENT header
                                      ▼
                           Merchant endpoint (/api/merchant/*)
                           returns 402, then data once paid
                                      │
                                      ▼
                           Facilitator (in-process) verifies and
                           settles on Solana devnet, pays the fee
                                      │
                                      ▼
                           Receipt ledger → dashboard statement
```

1. The agent decides what to buy and calls `pay_and_fetch` with a merchant id and a reason. It only sees tool results, never keys.
2. The x402 client requests the merchant URL and gets a 402 with the price and payee.
3. Before anything is signed, the policy engine checks the payment against the owner's rules and the spend history. The first failing rule wins and is written to the statement.
4. If allowed, the client signs a devnet USDC transfer from the agent wallet to the merchant wallet and retries with the payment header.
5. The facilitator verifies and settles the transfer on Solana, and the merchant returns the data. We run the facilitator inside the app (`@x402/svm` facilitator scheme) with its own fee-payer wallet, because the public x402.org facilitator's settle step was being rate-limited by its RPC during the build.

The three demo merchants live in the same app so the demo is self-contained. Two of them sell real data:

| Merchant | Price | Data |
|---|---|---|
| FX Rates | $0.01 | Live USD exchange rates (open.er-api.com) |
| SOL Price | $0.02 | Live SOL/USD and 24h change (CoinGecko) |
| Premium Market Report | $2.00 | A long report, priced to trip the per-purchase cap |

### The agent

With `ANTHROPIC_API_KEY` set, Claude Haiku 5.5 plans the purchases in a tool loop (`src/lib/agent.ts`). Without a key, a scripted planner picks merchants from keywords in the task and calls the same tools, so payments, rule checks and receipts are still real. The dashboard's agent console streams each step either way.

## Devnet addresses

| Wallet | Address |
|---|---|
| Agent (payer) | `6tzfXNJHE8XvjQWPUksZtkypiTaEoqTM1HaDdLX7jMGN` |
| Merchant (payee) | `DYPdj3y9MSSfTGZySPBmN5GhdbFUVYRxhoK4aqbHm2CA` |
| Facilitator fee payer | `93k3PRapsMuAcemY1zesqHgsopd7ZKy7bf4mdQzzVCMT` |
| USDC mint (Circle devnet) | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

No custom on-chain program. Payments are SPL token transfers settled through x402.

## Run it

```bash
npm install
node scripts/gen-wallets.mjs  # once: creates agent + merchant wallets in .env.local
# fund the agent wallet with devnet SOL and USDC, then:
node --env-file=.env.local scripts/setup-facilitator.mjs   # once: creates and funds the fee payer
npm run dev                   # http://localhost:3000
```

`.env.local` needs (see `.env.example`):

| Variable | What |
|---|---|
| `SVM_PRIVATE_KEY`, `AGENT_ADDRESS` | Agent wallet (base58 secret key), written by `gen-wallets.mjs`. Fund with devnet SOL (faucet.solana.com) and devnet USDC (faucet.circle.com) |
| `MERCHANT_PAY_TO` | Merchant wallet address |
| `FACILITATOR_PRIVATE_KEY`, `FACILITATOR_ADDRESS` | Written by the setup script |
| `SOLANA_RPC_URL` | Defaults to `https://api.devnet.solana.com` |
| `ANTHROPIC_API_KEY` | Optional. Leave empty for the scripted planner |
| `FACILITATOR_URL` | Optional. Set to use a remote x402 facilitator instead of the built-in one |

## Code map

| Path | Role |
|---|---|
| `src/lib/policy.ts` | Rule engine, a pure function from (rules, history, payment) to allow or block |
| `src/lib/payments.ts` | x402 client with the policy hook; writes receipts |
| `src/lib/x402-server.ts` | Merchant paywall and the in-process facilitator |
| `src/lib/agent.ts` | Claude tool loop and the no-key planner |
| `src/lib/store.ts` | Rules and receipts (JSON file in `data/`) |
| `src/app/page.tsx` | Owner dashboard |
| `src/app/api/*` | `agent` (streamed NDJSON), `approval`, `pay`, `policy`, `ledger`, `wallets`, `merchant/*` |

## Limits and next steps

- Rules are enforced by our server, which holds the key. Next is moving them on-chain (a program or token-account delegate with spending limits) so the owner doesn't have to trust the server either.
- Approvals happen on the dashboard only. Phone or chat approvals are next.
- The store is a JSON file; a hosted database is needed for multi-user use.
- Next: more merchants, team accounts with per-agent budgets, and phone or chat approvals.
