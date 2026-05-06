# DodoArc

DodoArc is a billing OS for AI agent products. It helps a user subscribe through Dodo Payments, activates credits after payment, and gives the product a clean dashboard for tracking subscriptions, credit usage, webhook activity, and settlement readiness.

Built for the Dodo Payments track at the Solana Frontier hackathon, DodoArc starts with a practical wedge: human-to-agent billing first, with infrastructure that can later support agent-operated payments.

## Milestone Status

### Milestone 1: Checkout and Credits

Milestone 1 proved the core billing loop:

- Plan discovery for an AI agent product.
- Dodo Payments checkout creation.
- Local mock checkout fallback for development.
- Payment webhook handling.
- Credit activation after successful payment.
- Dashboard visibility for subscription and credit state.
- Backend tests for credit and webhook behavior.

### Milestone 2: Persistent Billing Dashboard

Milestone 2 turns the MVP into a stronger product foundation:

- SQLite-backed persistence for users, subscriptions, events, webhook logs, and credit state.
- Dedicated landing page and authenticated-style dashboard surface.
- Webhook idempotency to prevent duplicate processing.
- Webhook processing logs for debugging and operational visibility.
- Solana settlement readiness endpoints for future stablecoin flows.
- Improved dashboard views for subscriptions, credits, events, webhooks, and settlement status.
- Expanded tests around webhook behavior and persistent billing state.

## Architecture

```mermaid
flowchart LR
    subgraph Frontend["Frontend"]
        Landing["Landing Page"]
        Dashboard["Dashboard"]
        MockSuccess["Mock Success Page"]
    end

    subgraph API["Node.js + Express API"]
        Plans["GET /api/plans"]
        Checkout["POST /api/checkout/create"]
        Subs["GET /api/subscriptions"]
        Credits["GET /api/credits/:userId"]
        Consume["POST /api/credits/consume"]
        Webhook["POST /api/webhook/dodo"]
        WebhookLog["GET /api/webhooks/log"]
        SolanaStatus["GET /api/solana/settlement-log"]
    end

    subgraph Services["Application Services"]
        DodoService["Dodo Checkout Wrapper"]
        CreditEngine["Credit Engine"]
        WebhookEngine["Webhook Processor"]
        SolanaService["Solana Readiness Service"]
    end

    subgraph Data["Persistence"]
        SQLite["SQLite Database"]
    end

    Dodo["Dodo Payments"]

    Landing --> Plans
    Landing --> Checkout
    MockSuccess --> Dashboard
    Dashboard --> Subs
    Dashboard --> Credits
    Dashboard --> Consume
    Dashboard --> WebhookLog
    Dashboard --> SolanaStatus

    Checkout --> DodoService
    DodoService --> Dodo
    Dodo --> Webhook

    Webhook --> WebhookEngine
    WebhookEngine --> CreditEngine
    CreditEngine --> SQLite
    Plans --> SQLite
    Subs --> SQLite
    Credits --> SQLite
    WebhookLog --> SQLite
```

## Workflow Map

```mermaid
flowchart TD
    A["User opens DodoArc"] --> B["Reviews billing plans"]
    B --> C["Selects Starter or Pro"]
    C --> D["DodoArc creates checkout session"]
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
    M --> N["Persist subscription, credits, event, and webhook log"]
    N --> O["Dashboard shows updated billing state"]
```

## Webhook Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI as DodoArc UI
    participant API as Express API
    participant Dodo as Dodo Payments
    participant DB as SQLite

    User->>UI: Select billing plan
    UI->>API: POST /api/checkout/create
    API->>Dodo: Create checkout session
    Dodo-->>API: Checkout URL
    API-->>UI: Return checkout URL
    User->>Dodo: Complete payment
    Dodo->>API: POST /api/webhook/dodo
    API->>DB: Check webhook event id
    API->>API: Process payment event once
    API->>DB: Store subscription, credits, event, and webhook log
    UI->>API: Fetch dashboard state
    API-->>UI: Return subscriptions, credits, and logs
```

## Tech Stack

- Node.js
- Express
- Dodo Payments SDK/API wrapper
- SQLite through `better-sqlite3`
- Static HTML, CSS, and JavaScript
- Jest and Supertest

## Project Structure

```text
DodoArc/
├── public/
│   ├── index.html
│   ├── landing.js
│   ├── dashboard.html
│   ├── dashboard.js
│   └── mock-success.html
├── src/
│   ├── config.js
│   ├── routes/
│   │   ├── checkout.js
│   │   ├── credits.js
│   │   ├── plans.js
│   │   ├── solana.js
│   │   ├── subscriptions.js
│   │   ├── webhook.js
│   │   └── webhooks.js
│   └── services/
│       ├── db.js
│       ├── dodo.js
│       ├── solana.js
│       └── sqlite.js
├── tests/
│   ├── credits.test.js
│   └── webhook.test.js
├── server.js
├── package.json
└── .env.example
```

## Environment

Create a `.env` file from `.env.example` and add Dodo test credentials.

```env
PORT=3000
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

DODO_API_KEY=dodo_test_your_key
DODO_WEBHOOK_SECRET=whsec_your_secret
DODO_ENVIRONMENT=test_mode

DB_PATH=./data/dodoarc.db
SOLANA_RPC_URL=https://api.devnet.solana.com
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

Dashboard:

```text
http://localhost:3000/dashboard
```

## Test

```bash
npm test
```

## Current Outcome

```mermaid
flowchart LR
    Plan["Plan"] --> Checkout["Checkout"]
    Checkout --> Payment["Payment"]
    Payment --> Webhook["Idempotent Webhook"]
    Webhook --> Credits["Credits Activated"]
    Credits --> Persistence["SQLite Persistence"]
    Persistence --> Dashboard["Billing Dashboard"]
```

DodoArc now demonstrates a testable billing foundation for AI agent products: Dodo Payments checkout, webhook-based activation, durable billing records, and a dashboard for operational visibility.
