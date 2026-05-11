phase	scaffold
completed_at	2026-05-11 05:10:00 +0530
project	DodoArc
mvp_complete	true
tests_passing	true
devnet_deployed	false

# DodoArc Build Context

## Scaffold Result

DodoArc has been built as a lightweight Node.js + Express + SQLite workspace for the Dodo Payments track, with Solana devnet settlement support and an MCP surface for agent-native usage.

The current repo is intentionally app-first rather than program-first:

- Express API for checkout, webhook processing, credits, developer apps, policies, agent runs, and MCP discovery.
- Static frontend in `public/` for landing, dashboard, embed widget, and app checkout preview.
- SQLite persistence through `better-sqlite3`.
- Solana devnet integration for wallet-aware settlement receipts.
- MCP server surface via `mcp.js` and `src/mcp/server.js`.

## Selected Architecture

- Node.js + Express for a fast hackathon delivery path.
- SQLite for persistent local state without external infra dependency.
- Dodo Payments for checkout session creation and verified webhook-based billing activation.
- Solana devnet for settlement proof and x402-style USDC receipt simulation.
- Multi-tenant developer platform layer with API-key auth and app-scoped policy enforcement.
- MCP discovery + tools so AI agents can use DodoArc directly as billing infrastructure.

## First MVP Demo

Dodo checkout or local demo payment  
-> verified webhook / idempotent event handling  
-> subscription + credit activation  
-> app-user registration  
-> app policy enforcement  
-> agent run  
-> x402-style settlement receipts  
-> live dashboard trace across payment, credits, runs, and settlements

## Implementation Notes

- No Anchor program is required for the current MVP.
- Solana is devnet-first and optional at runtime; the app remains runnable with mock settlement receipts when wallet/private-key config is absent.
- `npm.cmd test` passes locally with `DB_PATH=C:/tmp/dodoarc-test.db`.
- `npm.cmd run smoke` validates the end-to-end local demo surface.
- MCP discovery is exposed at `/.well-known/mcp`, with scoped tools implemented in `src/mcp/server.js`.
- The repo already includes `.superstack/build-context.md`; this file now reflects the current Milestone 7 implementation state.

## Immediate Next Steps

- Record the final demo using the Milestone 7 dashboard: checkout, webhook, policy gate, agent run, and settlement trace.
- Add one stronger live Solana settlement demo path when wallet credentials are configured.
- Improve dashboard presentation around operator metrics, revenue visibility, and judge-facing flow clarity.
- Prepare submission copy, demo script, screenshots, and proof assets around the "programmable spend-control layer" positioning.

## Build Status

Completed milestones:

### Milestone 1: Checkout and Credits

- Added plan discovery and Dodo checkout creation.
- Added local checkout fallback for demo mode.
- Added webhook-driven credit activation.
- Added initial dashboard visibility for subscriptions and credits.

### Milestone 2: Persistent Billing Dashboard

- Added SQLite persistence for users, subscriptions, events, and webhook logs.
- Added landing page and dashboard split.
- Added webhook idempotency and processing visibility.
- Added durable webhook log and billing dashboard foundation.

### Milestone 3: Agent Runs and Solana Settlement Receipts

- Added `POST /api/agent/run` and `GET /api/agent/runs`.
- Added credit deduction before agent execution.
- Added x402-style settlement receipt generation per run.
- Added Solana devnet-ready settlement log and explorer-linked receipts.

### Milestone 4: Live Operator Dashboard

- Added live metrics aggregation from SQLite state.
- Added overview, billing, credit, and settlement views backed by real data.
- Added demo flow linking payment simulation to agent execution and receipts.
- Added live refresh behavior for webhook and agent-run activity.

### Milestone 5: Demo Readiness and QA

- Added `scripts/smoke-test.js`.
- Added `scripts/check-env.js`.
- Added repeatable local demo verification path for judging and recording.

### Milestone 6: Developer Platform

- Added developers, API keys, developer apps, and embed checkout support.
- Added `/embed/dodoarc.js`.
- Added app checkout preview route at `/checkout/:appId`.
- Added API-key auth for protected developer and agent actions.
- Added MCP discovery and MCP tool surface.

### Milestone 7: Programmable Spend Control

- Added app policies for daily caps, per-run caps, approval thresholds, and pause/resume.
- Added tenant-scoped subscriptions, runs, settlements, and dashboard reads.
- Added app-user registration from checkout and webhook activation.
- Added policy enforcement before agent runs and credit consumption.
- Added dashboard views for My Apps, Spend Policies, Live Trace, and MCP tools.
- Added demo-flow hardening so agent runs and simulated payments preserve developer/app scope.

## Current Verification

- `npm.cmd test`: passing (`35/35`)
- `npm.cmd run smoke`: passing (`13/13`)
- `node --check public/dashboard.js`: passing
- `GET /api/health`: returns `status: ok`

## Current Known Constraints

- Solana settlement still falls back to mock receipts unless runtime wallet credentials are configured.
- The app uses SQLite local persistence rather than a hosted production database.
- Revenue and dashboard views are optimized for demo and operator visibility, not yet for multi-workspace production analytics.

## Pipeline Handoff

pipeline.ingestion_method: verified webhook

pipeline.data_types: Dodo checkout / payment / subscription events, app policies, agent runs, settlement receipts

pipeline.storage: SQLite local persistence

pipeline.backfill_implemented: false
