phase	idea
completed_at	2026-05-12 07:20:00 +0530
project	DodoArc

DodoArc Idea Context

Chosen Idea

DodoArc is billing and spend-control infrastructure for AI products using Dodo Payments and Solana.

One-liner:

DodoArc lets founders keep their own AI app, sell access in fiat through Dodo Payments, enforce app-level spend policies before backend tool usage, and trace settlement receipts on Solana.

Target User

AI and SaaS founders building products with paid model, tool, or agent usage that need:

- Dodo-based checkout and billing
- app-linked subscriptions and credits
- guardrails before expensive backend tool execution
- operator visibility from payment to settlement
- separate founder and user surfaces so operators and customers do not share the same dashboard

Problem

AI products can monetize with normal checkout rails, but the infrastructure after payment is still messy:

- users pay in fiat, while founder backends spend against APIs and tools
- billing systems stop at checkout instead of controlling post-payment spend
- developers need caps, pause controls, and approval thresholds
- operators need a traceable path from payment to credits to execution to settlement
- mainstream users should not need crypto wallets just to access an AI product

Solution

DodoArc connects Dodo Payments billing to app-scoped backend execution:

- users pay with familiar fiat rails through Dodo
- DodoArc activates subscriptions and credits from verified webhooks
- users are linked to founder apps
- founders and users authenticate into role-specific surfaces
- backend actions are checked against app policy before credits are consumed
- each paid tool call can produce a Solana settlement receipt
- developers and operators get a full trace from checkout to spend to settlement

Core demo:

Dodo checkout
-> verified webhook
-> subscription + credit activation
-> app user registration
-> policy enforcement
-> backend run
-> Solana receipt creation
-> operator dashboard trace

Why Solana

Solana is used for fast, low-cost, verifiable settlement proof for paid tool usage. The current MVP is devnet-oriented and can fall back to mock receipts locally, while the stronger product path is programmable settlement and treasury-aware AI billing infrastructure.

Dodo Integration

Required MVP integrations:

- Dodo checkout sessions
- checkout metadata linking users to plans/apps
- verified Dodo webhooks
- `payment.succeeded`
- subscription + credits activation
- dashboard visibility across billing, policy, and usage events
- role-aware founder login and user access pages

MVP Milestones

Build checkout, webhook, and credit activation.
Add durable dashboard visibility and billing persistence.
Add backend execution with receipt-linked settlement proof.
Add API keys, app checkout, and embed support.
Add app-level spend policies and tenant-scoped control.
Add role-based login so founders land on the operator dashboard and users land on their own access page.

Links

GitHub: https://github.com/ShivamSoni20/DodoArc
X: https://x.com/DodoArc_
