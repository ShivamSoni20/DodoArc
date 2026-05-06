# DodoArc

DodoArc is a Milestone 1 MVP for a billing operating system for AI agent products. It proves the first commercial loop: a user chooses a plan, starts a Dodo Payments checkout, receives payment confirmation through a webhook, and gets application credits activated in the dashboard.

Built for the Dodo Payments track at the Solana Frontier hackathon, DodoArc focuses on a practical wedge for AI products: human-to-agent billing first, with a clean path toward agent-operated payment flows later.

## Milestone 1

Milestone 1 focuses only on the core billing foundation:

- Plan discovery for an AI agent product.
- Dodo Payments checkout creation.
- Local mock checkout fallback for development.
- Payment webhook handling.
- Credit activation after successful payment.
- Dashboard visibility for subscriptions and credits.
- Backend tests for credit and webhook behavior.

## Architecture

```mermaid
flowchart LR
    subgraph Frontend["Frontend"]
        Landing["Landing Page"]
        Dashboard["Dashboard"]
        MockSuccess["Mock Success Page"]
    end

    subgraph Backend["Node.js + Express"]
        Plans["GET /api/plans"]
        Checkout["POST /api/checkout/create"]
        Subs["GET /api/subscriptions"]
        Credits["GET /api/credits/:userId"]
        Consume["POST /api/credits/consume"]
        Webhook["POST /api/webhook/dodo"]
    end

    subgraph Services["MVP Services"]
        DodoService["Dodo Checkout Wrapper"]
        CreditEngine["Credit Engine"]
        Store["MVP Data Store"]
    end

    Dodo["Dodo Payments"]

    Landing --> Plans
    Landing --> Checkout
    MockSuccess --> Dashboard
    Dashboard --> Subs
    Dashboard --> Credits
    Dashboard --> Consume

    Checkout --> DodoService
    DodoService --> Dodo
    Dodo --> Webhook

    Webhook --> CreditEngine
    Consume --> CreditEngine
    CreditEngine --> Store
    Plans --> Store
    Subs --> Store
    Credits --> Store
```

## Workflow Map

```mermaid
flowchart TD
    A["User opens DodoArc"] --> B["Reviews available plans"]
    B --> C["Selects Starter or Pro"]
    C --> D["DodoArc creates checkout session"]
    D --> E{"Dodo checkout available?"}
    E -->|Yes| F["Redirect to Dodo Payments"]
    E -->|Local fallback| G["Open mock success flow"]
    F --> H["Payment succeeds"]
    G --> H
    H --> I["Webhook/payment success is processed"]
    I --> J["Subscription is activated"]
    J --> K["Credits are added to the account"]
    K --> L["Dashboard shows active credit balance"]
```

## Webhook Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI as DodoArc UI
    participant API as Express API
    participant Dodo as Dodo Payments
    participant Store as MVP Store

    User->>UI: Select billing plan
    UI->>API: POST /api/checkout/create
    API->>Dodo: Create checkout session
    Dodo-->>API: Checkout URL
    API-->>UI: Return checkout URL
    User->>Dodo: Complete payment
    Dodo->>API: POST /api/webhook/dodo
    API->>API: Process payment event
    API->>Store: Activate subscription and credits
    UI->>API: Fetch updated credit state
    API-->>UI: Return active balance
```

## Tech Stack

- Node.js
- Express
- Dodo Payments SDK/API wrapper
- Static HTML, CSS, and JavaScript
- Jest and Supertest

## Project Structure

```text
DodoArc/
├── public/
│   ├── index.html
│   ├── app.js
│   └── mock-success.html
├── src/
│   ├── config.js
│   ├── routes/
│   │   ├── checkout.js
│   │   ├── credits.js
│   │   ├── plans.js
│   │   ├── subscriptions.js
│   │   └── webhook.js
│   └── services/
│       ├── db.js
│       └── dodo.js
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
```

Use test mode while developing. Never commit production API keys or webhook secrets.

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Test

```bash
npm test
```

## Milestone 1 Outcome

```mermaid
flowchart LR
    Plan["Plan"] --> Checkout["Checkout"]
    Checkout --> Payment["Payment"]
    Payment --> Webhook["Webhook"]
    Webhook --> Credits["Credits"]
    Credits --> Access["Dashboard Access"]
```

DodoArc Milestone 1 demonstrates that an AI product can turn a successful Dodo Payments checkout into usable product credits with a simple, testable backend flow.
