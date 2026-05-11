phase	idea
completed_at	2026-05-11 05:10:00 +0530
project	DodoArc

# DodoArc Idea Context

## Chosen Idea

DodoArc is a programmable spend-control layer for AI agent products using Dodo Payments and Solana.

One-liner:

DodoArc lets human users pay in familiar fiat rails, then lets agents spend those credits only within app-defined policy, with settlement receipts traced on Solana.

## Target User

- AI product founders selling agent workflows to mainstream users.
- Developer teams building agent products that need billing, usage control, and spend guardrails.
- Operator teams that need visibility from checkout to credits to agent execution to settlement.

## Problem

AI agents can now call paid tools and trigger real spend, but the billing stack around them is still incomplete:

- users pay in fiat, while agents operate in API and crypto-native environments
- billing systems stop at checkout and do not control post-payment agent spend
- mainstream users do not start with wallets like Phantom
- developers need app-level caps, pause controls, and approval thresholds
- operators need a traceable path from payment to credits to settlement

## Solution

DodoArc connects Dodo Payments checkout to app-scoped agent execution:

- users pay via Dodo Payments
- DodoArc activates credits from verified webhook events
- users are linked to developer apps
- agent runs are checked against policy before credits are consumed
- each paid tool call can produce a verifiable Solana settlement receipt
- developers and operators manage the full lifecycle from one dashboard

## Core Demo

Dodo checkout or local demo payment  
-> verified webhook  
-> credit activation  
-> app user registration  
-> policy check  
-> agent run  
-> x402-style settlement receipts  
-> live dashboard trace

## Why Solana

Solana is used for fast, low-cost, verifiable settlement proof for agent-paid tool usage. The MVP uses devnet-oriented receipt generation and can execute real settlement when credentials are configured. The stronger product path is programmable settlement and policy-aware treasury routing for AI-native commerce.

## Dodo Integration

Required MVP integrations:

- Dodo checkout session creation
- verified Dodo webhook handling
- payment.succeeded lifecycle for credit activation
- subscription / billing visibility in the dashboard
- app-scoped metadata linking checkout to developer products

## MVP Milestones

- Build checkout, webhook, and credit activation.
- Add durable dashboard visibility and billing persistence.
- Add agent execution with receipt-linked settlement proof.
- Add developer apps, API keys, embed checkout, and MCP discovery.
- Add app-level spend policies and tenant-scoped control.

## Links

GitHub: https://github.com/ShivamSoni20/DodoArc
