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
- Tests passing: yes
- Devnet deployed: no
- Program ID: not applicable yet
