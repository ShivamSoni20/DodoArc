# DodoArc Build Context

## Project

DodoArc is a billing OS for AI agent products, built for the Dodo Payments track in the Colosseum Frontier hackathon.

## Milestone 1

Goal: launch a working Dodo Payments checkout flow with webhook-driven credit activation.

Implemented stack:
- Node.js + Express backend
- Static HTML/CSS frontend served from `public/index.html`
- Dodo Payments checkout session integration through the `dodopayments` SDK when credentials are configured
- Local mock checkout fallback for development without Dodo credentials
- Standard Webhooks-style signature verification
- In-memory users, subscriptions, credits, events, and webhook idempotency
- Solana devnet-ready settlement config endpoint

## Architecture Decisions

- Use existing Dodo-hosted checkout for Milestone 1 instead of building payment UI.
- Keep credits in an in-memory store for the hackathon MVP, with a clean service boundary for SQLite/Postgres later.
- Treat webhooks as the source of truth for paid plan activation.
- Keep Solana work devnet-first. Milestone 1 exposes settlement config only; real USDC transfer/x402 settlement is Milestone 2.

## Build Status

- Milestone 1 MVP: implemented
- Milestone 2 MVP: implemented
- Milestone 3 MVP: implemented
- Tests passing: yes
- Devnet deployed: no
- Program ID: not applicable yet

## Milestone 2

Goal: improve webhook reliability and split the product site from the operator dashboard.

Implemented:
- SQLite persistence through `better-sqlite3`
- Durable users, subscriptions, events, and webhook delivery log
- Idempotent webhook processing using event IDs
- Retry-aware webhook status tracking with retry counts and failure messages
- Webhook log API at `/api/webhooks/log`
- Landing page at `/`
- Standalone dashboard at `/dashboard`
- Dashboard view router with Overview, Subscribers, Webhooks, Credits, Settlement, and related views
- Solana devnet settlement-log endpoint for the next x402/USDC milestone

Solana status:
- Still devnet-first.
- Real devnet USDC transfer path exists when `SOLANA_PRIVATE_KEY` and `X402_TOOL_PROVIDER_WALLET` are configured.
- Mock x402 receipts are used automatically without a private key so the demo remains runnable.
- Phantom/browser wallet connect is wired in the dashboard.

## Milestone 3

Goal: ship a working agent flow that consumes credits and creates x402-style Solana settlement receipts.

Implemented:
- Phantom wallet connect and demo wallet fallback in the dashboard
- `POST /api/solana/connect-wallet`
- `GET /api/solana/wallet-status`
- Demo Trading Signal Agent service
- `POST /api/agent/run`
- `GET /api/agent/runs`
- Agent run persistence in SQLite
- Settlement receipt persistence in SQLite
- `/api/solana/settlement-log` now returns real stored receipts
- Mock x402 settlement by default, real devnet USDC transfer when wallet/private key are configured
- Dashboard Agents view with run button, receipts, run history, and live settlement data
- Devnet setup helper at `scripts/setup-devnet.js`
