# DodoArc

DodoArc is billing and spend-control infrastructure for AI products. Founders keep their own app, Dodo handles checkout, DodoArc activates credits, enforces backend spend policy, and traces settlement receipts on Solana.

## Problem

AI products can now call paid tools, spend credits, and trigger real financial actions, but the billing stack around them is still incomplete.

- Users pay in familiar local rails like UPI and cards.
- Founder backends operate in API and crypto-native environments.
- Billing systems handle checkout, but not controlled spend after payment.
- Operators still lack a clear path from fiat payment to credits, backend execution, and settlement.

That leaves a missing layer between human payment and autonomous agent action.

## Solution

DodoArc connects familiar fiat checkout on the front end with policy-controlled backend execution on the back end:

- Human users pay through Dodo Payments using familiar rails.
- DodoArc activates credits and links the user to a founder app.
- Backend runs consume those credits only if the app policy allows the action.
- Every paid tool call can generate a verifiable USDC settlement receipt on Solana.
- Operators and developers get a live dashboard, webhook visibility, traceability, and app-scoped controls.

In short, DodoArc turns:

- `Fiat in`
- `Policy-controlled backend spend`
- `Solana settlement receipts out`

## What DodoArc Solves

- Lets non-crypto users pay for AI products with familiar local rails.
- Gives founders a control plane for app-level budgets and spending rules.
- Prevents unsafe backend actions before credits are consumed.
- Bridges offchain billing with onchain-verifiable settlement receipts.
- Makes the full payment-to-agent-to-settlement path observable for operators.

## What DodoArc Provides

- Dodo Payments checkout integration for human users.
- Credit activation and subscription tracking after successful payment.
- Multi-tenant app integrations with API keys and embeddable checkout.
- Founder and user login surfaces with role-based access to dashboard and app pages.
- Per-app spend policies for pause/resume, daily caps, per-run caps, and approval thresholds.
- Backend execution with enforced credit deduction and policy checks.
- x402-style Solana settlement receipts for paid tool calls.
- MCP discovery for runtime and backend integration.
- Live dashboard visibility across subscriptions, credits, webhooks, agent runs, and settlements.

## Architecture

```mermaid
flowchart LR
    subgraph Frontend["Frontend"]
        Landing["Landing Page"]
        Dashboard["Live Dashboard"]
        Embed["Embeddable Checkout Widget"]
        AppCheckout["App Checkout Preview"]
    end

    subgraph API["Node.js + Express API"]
        Auth["POST/GET /api/auth/*"]
        Plans["GET /api/plans"]
        Checkout["POST /api/checkout/create"]
        Subs["GET /api/subscriptions"]
        Credits["GET /api/credits/:userId"]
        Consume["POST /api/credits/consume"]
        Webhook["POST /api/webhook/dodo"]
        WebhookLog["GET /api/webhooks/log"]
        Wallet["POST /api/solana/connect-wallet"]
        AgentRun["POST /api/agent/run"]
        AgentRuns["GET /api/agent/runs"]
        SettlementLog["GET /api/solana/settlement-log"]
        Metrics["GET /api/dashboard/metrics"]
        Demo["GET/POST /api/demo/*"]
        Developer["GET/POST /api/developer/*"]
        Policies["GET/PUT /api/developer/apps/:appId/policy"]
        AppUsers["GET /api/developer/apps/:appId/users"]
        MCPDiscovery["GET /.well-known/mcp"]
    end

    subgraph Services["Application Services"]
        DodoService["Dodo Checkout Wrapper"]
        CreditEngine["Credit Engine"]
        WebhookEngine["Webhook Processor"]
        AgentService["Backend Spend Runtime"]
        X402Service["x402 Settlement Service"]
        SolanaService["Solana Devnet Service"]
        MetricsService["Dashboard Metrics Aggregator"]
        DeveloperService["Developer Platform"]
        MCPService["MCP Server"]
    end

    subgraph Data["Persistence"]
        SQLite["SQLite Database"]
    end

    Dodo["Dodo Payments"]
    Solana["Solana Devnet"]
    LiveUpdates["WebSocket Live Updates"]

    Landing --> Auth
    Landing --> Plans
    Landing --> Checkout
    Dashboard --> Subs
    Dashboard --> Credits
    Dashboard --> Consume
    Dashboard --> WebhookLog
    Dashboard --> Wallet
    Dashboard --> AgentRun
    Dashboard --> AgentRuns
    Dashboard --> SettlementLog
    Dashboard --> Metrics
    Dashboard --> Demo
    Dashboard --> Developer
    Dashboard --> Policies
    Dashboard --> AppUsers
    Developer --> Embed
    Embed --> Checkout
    AppCheckout --> Checkout
    MCPDiscovery --> MCPService

    Checkout --> DodoService
    DodoService --> Dodo
    Dodo --> Webhook

    Webhook --> WebhookEngine
    WebhookEngine --> CreditEngine
    CreditEngine --> SQLite

    AgentRun --> CreditEngine
    AgentRun --> AgentService
    AgentService --> X402Service
    X402Service --> SolanaService
    SolanaService --> Solana
    AgentService --> SQLite

    WebhookEngine --> LiveUpdates
    AgentService --> LiveUpdates
    LiveUpdates --> Dashboard

    Metrics --> MetricsService
    MetricsService --> SQLite
    Developer --> DeveloperService
    Policies --> DeveloperService
    AppUsers --> DeveloperService
    DeveloperService --> SQLite
    MCPService --> CreditEngine
    MCPService --> AgentService

    Plans --> SQLite
    Subs --> SQLite
    Credits --> SQLite
    WebhookLog --> SQLite
    AgentRuns --> SQLite
    SettlementLog --> SQLite
```

## Workflow Map

```mermaid
flowchart TD
    A["Founder logs into DodoArc"] --> B["Creates app integration and maps plan to credits"]
    B --> C["Founder connects Dodo billing and webhook secret"]
    C --> D["User buys access in the founder's app"]
    D --> E{"Dodo checkout available?"}
    E -->|Yes| F["Redirect to Dodo Payments"]
    E -->|Local fallback| G["Open mock success flow"]
    F --> H["Payment succeeds"]
    G --> H
    H --> I["Dodo sends webhook event"]
    I --> J["DodoArc checks idempotency"]
    J --> K{"Already processed?"}
    K -->|Yes| L["Return safe duplicate response"]
    K -->|No| M["Activate subscription credits"]
    M --> N["Register app user + persist subscription, credits, event, and webhook log"]
    N --> O["Founder backend asks DodoArc before a paid run"]
    O --> P["DodoArc loads app spend policy"]
    P --> Q["Backend action requests credits"]
    Q --> R{"Policy allows run?"}
    R -->|No| S["Return blocked state before credits are consumed"]
    R -->|Yes| T["Deduct mapped run credits"]
    T --> U["Create x402-style settlement receipts"]
    U --> V["Persist agent run and receipt history"]
    V --> W["Dashboard refreshes live with metrics, trace events, and explorer links"]
```

## Developer Platform Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Portal as DodoArc Developer Portal
    participant API as DodoArc API
    participant Policy as Spend Policy Engine
    participant Site as External Agent App
    participant Dodo as Dodo Checkout
    participant Agent as AI Agent

    Dev->>Portal: Sign up as founder
    Portal->>API: POST /api/auth/signup
    API-->>Portal: Founder session + API key
    Dev->>Portal: Create app integration
    Portal->>API: POST /api/developer/apps
    API-->>Portal: Embed code + checkout preview
    Dev->>Site: Paste /embed/dodoarc.js snippet into existing app
    Site->>API: POST /api/checkout/create
    API->>Dodo: Create checkout session
    Dodo-->>API: payment.succeeded webhook
    API->>API: Register app user + activate credits
    API-->>Agent: Credits available for scoped user
    Agent->>API: POST /api/agent/run with x-api-key and appId
    API->>Policy: Enforce app spend policy
    Policy-->>API: Allow or block
    API-->>Agent: Signal + x402 settlement receipts or policy block
```

## Agent Settlement Sequence

```mermaid
sequenceDiagram
    participant UI as Dashboard
    participant API as Agent API
    participant Credits as Credit Engine
    participant Agent as Founder Backend
    participant Solana as Solana Devnet
    participant DB as SQLite

    UI->>API: POST /api/agent/run
    API->>Credits: Deduct mapped credits
    Credits-->>API: Credits remaining
    API->>Agent: Run paid tool workflow
    Agent->>Solana: x402-style USDC settlement
    Solana-->>Agent: Transaction signature or mock receipt
    API->>DB: Store agent run and settlement receipts
    API-->>UI: Return signal, receipts, and explorer links
```

## Tech Stack

- Node.js
- Express
- Dodo Payments SDK/API wrapper
- SQLite through `better-sqlite3`
- Solana Web3.js and SPL Token tooling
- WebSocket live dashboard updates through `ws`
- MCP server through `@modelcontextprotocol/sdk`
- Static HTML, CSS, and JavaScript
- Jest and Supertest

## Project Structure

```text
DodoArc/
|-- public/
|   |-- app.html
|   |-- login.html
|   |-- embed/dodoarc.js
|   |-- index.html
|   |-- login.js
|   |-- landing.js
|   |-- dashboard.html
|   |-- dashboard.js
|   |-- user-dashboard.js
|   `-- mock-success.html
|-- scripts/
|   |-- check-env.js
|   |-- setup-devnet.js
|   |-- setup-dodo-products.js
|   |-- smoke-test.js
|   `-- verify-dodo-checkout.js
|-- src/
|   |-- config.js
|   |-- middleware/auth.js
|   |-- mcp/server.js
|   |-- routes/
|   |   |-- auth.js
|   |   |-- agent.js
|   |   |-- checkout.js
|   |   |-- credits.js
|   |   |-- demo.js
|   |   |-- developer.js
|   |   |-- metrics.js
|   |   |-- plans.js
|   |   |-- solana.js
|   |   |-- subscriptions.js
|   |   |-- webhook.js
|   |   `-- webhooks.js
|   `-- services/
|       |-- agent.js
|       |-- db.js
|       |-- dodo.js
|       |-- solana.js
|       `-- sqlite.js
|-- tests/
|   |-- agent.test.js
|   |-- credits.test.js
|   |-- dashboard.test.js
|   |-- developer.test.js
|   |-- policies.test.js
|   `-- webhook.test.js
|-- mcp.js
|-- server.js
|-- package.json
`-- .env.example
```

## Environment

Create a `.env` file from `.env.example` and add Dodo test credentials.

```env
PORT=3000
BASE_URL=http://localhost:3000
SMOKE_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

DODO_PAYMENTS_API_KEY=dodo_test_your_key
DODO_PAYMENTS_WEBHOOK_SECRET=whsec_your_secret
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PRO_PRODUCT_ID=prod_your_pro_product_id

DB_PATH=./data/dodoarc.db
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=
USDC_MINT_DEVNET=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
SETTLEMENT_WALLET_PUBLIC_KEY=
X402_TOOL_PROVIDER_WALLET=
```

Use Dodo test mode while developing. Never commit production API keys or webhook secrets.

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Founder login:

```text
http://localhost:3000/login?role=founder
```

Dashboard:

```text
http://localhost:3000/dashboard
```

User access:

```text
http://localhost:3000/app
```

## Test and Verify

```bash
npm test
npm run smoke
npm run check-env
```

Run the MCP server:

```bash
npm run mcp
```

Verify Dodo checkout configuration:

```bash
npm run verify-dodo
```

## Current Outcome

```mermaid
flowchart LR
    Plan["Plan"] --> Checkout["Checkout"]
    Checkout --> Payment["Payment"]
    Payment --> Webhook["Idempotent Webhook"]
    Webhook --> Credits["Credits Activated"]
    Credits --> Agent["Agent Run"]
    Agent --> Policy["Spend Policy Check"]
    Policy --> Settlement["x402 Settlement Receipt"]
    Settlement --> Persistence["SQLite Persistence"]
    Persistence --> Dashboard["Live Billing Dashboard"]
    Dashboard --> Developer["Developer Portal"]
    Developer --> Embed["Embeddable Checkout"]
    Developer --> PolicyUI["Spend Policy UI"]
    Developer --> MCP["MCP Server"]
```

DodoArc now demonstrates a testable billing and spend-control foundation for AI products: Dodo Payments checkout, webhook-based activation, durable tenant-scoped billing records, credit-backed backend execution, app-level spend controls, x402-style Solana settlement receipts, live operator metrics, developer API keys, embeddable checkout, and MCP integration.
