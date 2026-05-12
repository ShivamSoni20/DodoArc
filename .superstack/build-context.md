phase	scaffold
completed_at	2026-05-12 07:20:00 +0530
project	DodoArc
mvp_complete	true
tests_passing	true
devnet_deployed	false

DodoArc Build Context

Scaffold Result

DodoArc has been scaffolded as a Node.js + Express + SQLite workspace for the Dodo Payments track, using the validated idea context in `.superstack/idea-context.md`.

The current repo is intentionally app-first instead of program-first:

- Express API for checkout, webhook processing, subscriptions, credits, founder app integrations, policies, backend runs, metrics, and settlement logs.
- Static frontend in `public/` for the landing page, founder dashboard, user access page, login flow, embed widget, and checkout preview.
- SQLite persistence through `better-sqlite3` for local state.
- Solana devnet-oriented receipt and settlement support, with mock fallback when live wallet credentials are missing.
- MCP discovery exposed through `mcp.js` and `/.well-known/mcp`.

Selected Architecture

Node.js + Express for fast hackathon iteration and low operational overhead.
Dodo Payments integration for checkout sessions, checkout metadata, subscriptions, credits activation, and verified webhooks.
SQLite for persistent local demo state without requiring hosted infra.
Solana devnet for stablecoin-style settlement proof and x402-style receipt simulation.
API-key scoped app layer for app creation, app policies, and app-linked backend usage.
Cookie-backed auth sessions for founder and user logins with role-specific redirects.
MCP discovery for runtime integration and developer tooling.

First MVP Demo

Dodo checkout
-> verified webhook handling
-> idempotent subscription + credit activation
-> founder app / user linkage
-> policy enforcement before spend
-> agent run
-> Solana settlement receipts
-> founder dashboard visibility across payments, credits, runs, and settlements
-> user access page visibility across plans and credits

Implementation Notes

No Anchor program is required for the current MVP.
Solana remains devnet-first and optional at runtime; the app still runs when settlement falls back to mock mode.
`npm test` passes locally using a temporary DB path.
`npm run smoke` validates the end-to-end local demo surface.
MCP discovery is exposed at `/.well-known/mcp`.
The current repo is optimized for a local working demo rather than a hosted production deployment.
Founder and user access now use local email/password auth with cookie sessions and role-based page gating.

Immediate Next Steps

Record the final demo around checkout, webhook activation, policy enforcement, and settlement receipts.
Tighten the infra positioning so DodoArc reads clearly as billing and spend-control infrastructure for AI products.
Optionally add a stronger live Solana settlement path once wallet credentials are available.
Package the final submission narrative, screenshots, and demo script around the infrastructure wedge instead of a broad end-user product story.

Build Status

Completed milestones:

Milestone 1: app/API foundation.
Added environment validation.
Added `/api/health`.
Added plan discovery, checkout creation, and initial subscription persistence.
Added basic landing and dashboard scaffolding.

Current verification:

`npm test`: passing.
`GET /api/health`: passing.

Pipeline handoff:

pipeline.ingestion_method: webhook

pipeline.data_types: Dodo payment/subscription/credit events and Solana settlement receipts

pipeline.storage: SQLite local persistence

pipeline.backfill_implemented: false

Milestone 2: Dodo checkout foundation.

Added Dodo checkout session creation.
Added local checkout fallback for demo mode.
Added plan-aware checkout creation through `/api/checkout/create`.
Verified a checkout URL is returned for the configured Dodo product.

Current Dodo checkout verification:

`POST /api/checkout/create`: returned a Dodo test checkout URL.

Milestone 3: verified webhook routing.

Added verified `POST /api/webhook/dodo`.
Added webhook idempotency via webhook log persistence.
Added subscription activation and credit top-up from payment events.
Added webhook log inspection and event recording.
Verified real and simulated `payment.succeeded` flows update local state.

Milestone 4: operator dashboard.

Added overview, subscribers, webhook log, credits, settlement, and backend run visibility in the dashboard.
Added live metrics backed by SQLite state instead of fake card values.
Added responsive dashboard rendering for local demo usage.
Wired checkout and webhook outcomes back into operator-visible state.

Current dashboard verification:

`GET /dashboard`: passing.
Overview and settlement surfaces render from live stored data.
Webhook and subscriber tables read from local persisted state.

Milestone 5: backend runs and settlement proof.

Added `POST /api/agent/run` and `GET /api/agent/runs`.
Added credit deduction before execution.
Added settlement receipt creation per paid tool call.
Added explorer-linked Solana-style receipt visibility.
Verified backend runs produce credits consumption and settlement rows.

Milestone 6: app integration layer.

Added developers, API keys, and founder app registration.
Added app checkout preview route at `/checkout/:appId`.
Added app-linked users and founder-scoped reads.
Added `/embed/dodoarc.js` for embeddable checkout.
Added MCP discovery metadata for external agent/tooling integration.

Milestone 7: programmable spend control.

Added app policies for daily caps, per-run caps, approval thresholds, and pause/resume.
Added policy enforcement before backend execution.
Added tenant-scoped subscriptions, runs, settlements, and dashboard queries.
Added demo flow hardening so simulated payments and runs preserve app scope.
Verified blocked-run and successful-run flows in tests.

Milestone 8: role-based access polish.

Added local email/password auth for founders and users.
Added cookie-backed sessions with founder dashboard and user access page gating.
Added founder logout, user logout, and post-checkout login routing.
Added founder session hydration so dashboard APIs work without manual key copy-paste after login.
Slowed the full demo flow so payment, run, and settlement stages are visible on camera.

Current verification:

`npm test`: passing (`45/45`)
`npm run smoke`: passing (`14/14`)
`GET /api/health`: returns `status: ok`
`GET /dashboard`: loads locally without the old dashboard key prompt

Current known constraints:

Solana settlement still falls back to mock receipts unless runtime wallet credentials are configured.
The app uses SQLite local persistence instead of hosted multi-tenant production storage.
The current UX still mixes operator dashboard concerns with submission/demo storytelling and may need final polish for judges.
