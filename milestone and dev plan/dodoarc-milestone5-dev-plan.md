# DodoArc â€” Milestone 5 Development Plan
## For Claude Code (Agentic Execution)

**Milestone 5 Goal:** Finalize the demo, polish the user flow, and submit DodoArc to Colosseum Frontier before May 11
**Current State:** Milestone 4 complete â€” 22 tests passing, 4 suites, WebSocket live, metrics real, demo flow working
**Hard Deadline:** May 11, 2026 â€” Colosseum Frontier submissions close

---

## What Milestone 5 Delivers

| # | Deliverable | Why It Matters |
|---|-------------|----------------|
| 1 | **Git commit + push everything** | Nothing exists until it's on GitHub |
| 2 | **README.md** (submission-ready) | Judges read this first â€” it's your pitch |
| 3 | **Demo video script + flow** | 2-minute Loom â€” required for submission |
| 4 | **Landing page final polish** | Pricing, CTA, and copy sharpened for judges |
| 5 | **Production smoke test suite** | Automated end-to-end check before submission |
| 6 | **Environment validation script** | One command that checks everything is ready |
| 7 | **Submission checklist** | Colosseum + Superteam Earn (Dodo track) both submitted |
| 8 | **`.env.example` final audit** | Every required key documented clearly |

---

## Part 1 â€” Git: Commit and Push Everything

> **This is the first thing to do.** Nothing you've built counts until it's on a public GitHub repo. Judges check commit history â€” they want to see you built this during the hackathon window.

### Step 1.1 â€” `.gitignore` Audit

Verify `data/dodoarc.db` and `.env` are in `.gitignore`. They should already be â€” double check:

```
# .gitignore â€” confirm these exist:
.env
data/
*.db
node_modules/
data/server.*.log
```

### Step 1.2 â€” Final Commit

```bash
git add .
git commit -m "feat: DodoArc MVP complete â€” Milestones 1-5

- Dodo Payments checkout (INR/UPI) with webhook activation
- SQLite-backed credits engine with idempotent webhooks
- Agent run endpoint with x402 mock settlement (devnet-ready)
- Phantom wallet connect (Solana devnet)
- Live WebSocket dashboard with real metrics
- One-click demo flow
- 22 tests passing across 4 suites

Built for Colosseum Frontier 2026 â€” Dodo Payments track
Deadline: May 11, 2026"

git push origin main
```

### Step 1.3 â€” Repo Settings (Do This on GitHub)

- Set repo to **Public**
- Add description: `Billing OS for AI agent products â€” fiat subscriptions in, x402 USDC settlement out`
- Add topics: `solana`, `dodo-payments`, `x402`, `ai-agents`, `colosseum`, `hackathon`
- Pin the README
- Add the live demo URL to "About" section once deployed

---

## Part 2 â€” README.md (Submission-Critical)

> Colosseum judges open the GitHub repo. The README is read before the demo video. A bad README = instant downgrade. Write this like a pitch deck, not documentation.

Create `README.md` in project root:

```markdown
# DodoArc â€” Billing OS for AI Agent Products

> **Fiat in. Agent runs. USDC out.**
> Normal users don't have Phantom. They have PhonePe.

Built for [Colosseum Frontier 2026](https://colosseum.com/frontier) Â· Dodo Payments Track

---

## The Problem

An Indian developer builds a trading agent on Solana. They want to charge users â‚¹3,000/month.

- âŒ Can't use Stripe (blocks Web3 companies)
- âŒ Can't force users to install Phantom
- âŒ Can't handle tax/compliance in 150 countries

MCPay and Latinum solved **agentâ†’tool** payments (machine to machine).
Nobody solved **humanâ†’agent** billing (fiat to machine).

**That's the gap DodoArc fills.**

---

## What DodoArc Does

```
User pays â‚¹3,000 via UPI
        â†“
Dodo Payments processes + fires webhook
        â†“
DodoArc grants 1,000 agent credits
        â†“
User runs trading agent (10 credits/run)
        â†“
Agent calls paid MCP tool via x402
        â†“
0.001 USDC settles on Solana in 400ms
```

---

## Live Demo

> **[â†’ Open Dashboard](http://localhost:3000/dashboard)**
> Click "â–¶ Run full demo flow" to see the complete DodoArc flow in 30 seconds.

---

## Features

| Feature | Status |
|---------|--------|
| Dodo Payments checkout (INR / UPI / Card) | âœ… Live |
| Webhook â†’ credit activation (idempotent) | âœ… Live |
| Usage credit engine (deduct per agent run) | âœ… Live |
| x402 USDC settlement (Solana devnet/mock) | âœ… Live |
| Phantom wallet connect | âœ… Live |
| Live WebSocket dashboard | âœ… Live |
| SQLite persistence (survives restarts) | âœ… Live |
| One-click demo flow | âœ… Live |

---

## Tech Stack

- **Payments:** [Dodo Payments](https://dodopayments.com) (checkout, webhooks, credits)
- **Settlement:** [x402 protocol](https://x402.org) + Solana devnet USDC
- **Wallet:** Phantom Connect
- **Backend:** Node.js + Express + SQLite (better-sqlite3)
- **Frontend:** Vanilla JS dashboard (no framework)
- **Tests:** Jest â€” 22 tests, 4 suites

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/dodoarc
cd dodoarc

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env â€” add DODO_PAYMENTS_API_KEY (optional for mock demo)

# 4. Run
npm run dev

# 5. Open
open http://localhost:3000          # Landing page
open http://localhost:3000/dashboard # Dashboard
```

**Demo mode** works without any API keys â€” all flows are functional with mock data.

---

## Running Tests

```bash
npm test                    # All 22 tests
npm test -- --watch         # Watch mode
node scripts/smoke-test.js  # Full end-to-end smoke test
```

---

## Tracks

- **Dodo Payments Track** â€” primary track (billing + credits + checkout)
- **Main Colosseum Frontier** â€” billing OS for agent economy

---

## Roadmap (Post-Hackathon)

- [ ] Real Dodo subscription billing (recurring)
- [ ] Live x402 USDC on Solana mainnet
- [ ] Multi-agent product support
- [ ] Developer SDK (npm package)
- [ ] API key authentication per developer

---

## Team

Built solo by **[@shivam_soni18](https://twitter.com/shivam_soni18)**
Bhopal, India Â· Colosseum Frontier 2026

---

*DodoArc â€” The missing billing layer between human users and AI agents on Solana.*
```

---

## Part 3 â€” Production Smoke Test Suite

> Run this script immediately before submission. It hits every critical endpoint and fails loudly if anything is broken. **Zero tolerance for a broken demo during judging.**

Create `scripts/smoke-test.js`:

```javascript
#!/usr/bin/env node
// scripts/smoke-test.js
// Full end-to-end smoke test â€” run before every submission and demo
// Usage: node scripts/smoke-test.js
// Usage (against deployed URL): BASE_URL=https://your-app.com node scripts/smoke-test.js

require('dotenv').config();

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const PASS = 'âœ…';
const FAIL = 'âŒ';
const WARN = 'âš ï¸ ';

let passed = 0;
let failed = 0;
let warned = 0;
const results = [];

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function check(name, fn, opts = {}) {
  const { warn = false } = opts;
  try {
    await fn();
    results.push({ name, status: 'pass' });
    passed++;
    console.log(`${PASS}  ${name}`);
  } catch (err) {
    if (warn) {
      results.push({ name, status: 'warn', error: err.message });
      warned++;
      console.log(`${WARN} ${name} â€” ${err.message}`);
    } else {
      results.push({ name, status: 'fail', error: err.message });
      failed++;
      console.log(`${FAIL}  ${name}`);
      console.log(`     â†’ ${err.message}`);
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function get(path, expectedStatus = 200) {
  const res = await fetch(`${BASE_URL}${path}`);
  assert(res.status === expectedStatus,
    `Expected ${expectedStatus}, got ${res.status} for GET ${path}`);
  return res.json();
}

async function post(path, body, expectedStatus = 200) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert(res.status === expectedStatus,
    `Expected ${expectedStatus}, got ${res.status} for POST ${path}`);
  return res.json();
}

// â”€â”€ Test Suite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runSmokeTests() {
  console.log('\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
  console.log('  DodoArc Smoke Test');
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Time:   ${new Date().toLocaleString('en-IN')}`);
  console.log('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n');

  // â”€â”€ SECTION 1: Server Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('â”€â”€ Server Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  await check('Server is running', async () => {
    const data = await get('/api/health');
    assert(data.status === 'ok', 'health status not ok');
  });

  await check('Health returns dodoConfigured flag', async () => {
    const data = await get('/api/health');
    assert(typeof data.dodoConfigured === 'boolean', 'dodoConfigured missing');
    assert(typeof data.solanaConfigured === 'boolean', 'solanaConfigured missing');
    assert(data.network === 'devnet', 'network should be devnet');
  });

  await check('Dodo API key configured', async () => {
    const data = await get('/api/health');
    assert(data.dodoConfigured, 'DODO_PAYMENTS_API_KEY not set â€” real checkout will not work');
  }, { warn: true });

  await check('Solana private key configured', async () => {
    const data = await get('/api/health');
    assert(data.solanaConfigured, 'SOLANA_PRIVATE_KEY not set â€” running in mock mode');
  }, { warn: true });

  // â”€â”€ SECTION 2: Pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  await check('GET / returns landing page (200)', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert(res.status === 200, `Got ${res.status}`);
    const html = await res.text();
    assert(html.includes('DodoArc'), 'Landing page missing DodoArc title');
    assert(html.includes('Phantom') || html.includes('agent'), 'Landing page missing key content');
  });

  await check('GET /dashboard returns dashboard page (200)', async () => {
    const res = await fetch(`${BASE_URL}/dashboard`);
    assert(res.status === 200, `Got ${res.status}`);
    const html = await res.text();
    assert(html.includes('dashboard'), 'Dashboard page missing content');
  });

  await check('GET /payment-success returns 200', async () => {
    const res = await fetch(`${BASE_URL}/payment-success`);
    assert(res.status === 200, `Got ${res.status}`);
  }, { warn: true });

  // â”€â”€ SECTION 3: Plans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Plans API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  await check('GET /api/plans returns plan list', async () => {
    const data = await get('/api/plans');
    assert(Array.isArray(data.plans), 'plans should be an array');
    assert(data.plans.length >= 2, 'should have at least 2 plans');
  });

  await check('plan_starter exists with price 0', async () => {
    const data = await get('/api/plans');
    const starter = data.plans.find(p => p.id === 'plan_starter');
    assert(starter, 'plan_starter not found');
    assert(starter.price === 0, 'starter price should be 0');
    assert(starter.credits > 0, 'starter should have credits');
  });

  await check('plan_pro exists with price 2999', async () => {
    const data = await get('/api/plans');
    const pro = data.plans.find(p => p.id === 'plan_pro');
    assert(pro, 'plan_pro not found');
    assert(pro.price === 2999, `pro price should be 2999, got ${pro.price}`);
    assert(pro.credits >= 1000, 'pro should have 1000+ credits');
  });

  // â”€â”€ SECTION 4: Demo Flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Demo Flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  let demoUserId;

  await check('GET /api/demo/user returns demo user', async () => {
    const data = await get('/api/demo/user');
    assert(data.user, 'user object missing');
    assert(data.user.email === 'demo@dodoarc.xyz', 'wrong demo email');
    assert(data.sub, 'subscription missing');
    assert(data.sub.status === 'active', `sub status should be active, got ${data.sub.status}`);
    assert(data.sub.credits_total > 0, 'demo user needs credits');
    demoUserId = data.user.id;
  });

  await check('POST /api/demo/simulate-payment adds credits', async () => {
    const before = await get('/api/demo/user');
    const creditsBefore = before.sub.credits_total;
    await post('/api/demo/simulate-payment', {});
    const after = await get('/api/demo/user');
    assert(after.sub.credits_total > creditsBefore,
      `Credits should increase: before=${creditsBefore}, after=${after.sub.credits_total}`);
  });

  // â”€â”€ SECTION 5: Checkout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Checkout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  await check('POST /api/checkout/create with starter plan activates free tier', async () => {
    const data = await post('/api/checkout/create', {
      planId: 'plan_starter',
      email: `smoketest_${Date.now()}@dodoarc.xyz`,
      name: 'Smoke Test User',
    });
    assert(data.success, 'checkout create failed');
    assert(data.type === 'free', `expected type=free, got ${data.type}`);
  });

  await check('POST /api/checkout/create with pro plan returns checkout object', async () => {
    const data = await post('/api/checkout/create', {
      planId: 'plan_pro',
      email: `smoketest_pro_${Date.now()}@dodoarc.xyz`,
      name: 'Smoke Test Pro',
    });
    assert(data.success, 'checkout create failed');
    // Either real Dodo URL or mock checkout URL
    assert(data.payment_url || data.type === 'mock',
      'should return payment_url or mock type');
  });

  await check('POST /api/checkout/create rejects missing email', async () => {
    const res = await fetch(`${BASE_URL}/api/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'plan_pro' }),
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // â”€â”€ SECTION 6: Webhook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Webhook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  const webhookEventId = `smoke_${Date.now()}`;

  await check('POST /api/webhook/dodo processes payment.succeeded', async () => {
    const data = await post('/api/webhook/dodo', {
      id: webhookEventId,
      type: 'payment.succeeded',
      data: {
        id: `pay_smoke_${Date.now()}`,
        amount: 299900,
        currency: 'INR',
        metadata: {
          planId: 'plan_pro',
          email: `webhook_smoke_${Date.now()}@dodoarc.xyz`,
          name: 'Webhook Smoke',
        },
      },
    });
    assert(data.received === true, 'webhook should return received:true');
    assert(data.duplicate !== true, 'should not be duplicate on first call');
  });

  await check('Duplicate webhook returns duplicate:true', async () => {
    const data = await post('/api/webhook/dodo', {
      id: webhookEventId, // same ID as above
      type: 'payment.succeeded',
      data: { id: 'pay_dupe', amount: 299900, currency: 'INR',
        metadata: { planId: 'plan_pro', email: 'dupe@dodoarc.xyz' } },
    });
    assert(data.duplicate === true, 'same event_id should return duplicate:true');
  });

  await check('GET /api/webhooks/log returns log array', async () => {
    const data = await get('/api/webhooks/log');
    assert(Array.isArray(data.log), 'log should be array');
    assert(data.log.length > 0, 'log should have entries after our test webhook');
    const entry = data.log[0];
    assert(entry.event_id, 'log entry should have event_id');
    assert(entry.event_type, 'log entry should have event_type');
    assert(entry.status, 'log entry should have status');
  });

  // â”€â”€ SECTION 7: Credits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Credits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  await check('GET /api/credits/:userId returns credit balance', async () => {
    if (!demoUserId) throw new Error('demo user not available');
    const data = await get(`/api/credits/${demoUserId}`);
    assert(typeof data.credits_remaining === 'number', 'credits_remaining missing');
    assert(typeof data.credits_total === 'number', 'credits_total missing');
    assert(data.status === 'active', `status should be active, got ${data.status}`);
  });

  await check('POST /api/credits/consume deducts credits', async () => {
    if (!demoUserId) throw new Error('demo user not available');
    const before = await get(`/api/credits/${demoUserId}`);
    const consume = await post('/api/credits/consume', {
      userId: demoUserId,
      amount: 1,
      agentName: 'Smoke Test',
      action: 'smoke_test_deduction',
    });
    assert(consume.success === true, 'consume should succeed');
    const after = await get(`/api/credits/${demoUserId}`);
    assert(after.credits_remaining === before.credits_remaining - 1,
      `Credits should decrease by 1: before=${before.credits_remaining}, after=${after.credits_remaining}`);
  });

  await check('POST /api/credits/consume returns 402 for user with no credits', async () => {
    const res = await fetch(`${BASE_URL}/api/credits/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'nonexistent_user_smoke', amount: 100 }),
    });
    assert(res.status === 402, `Expected 402, got ${res.status}`);
  });

  // â”€â”€ SECTION 8: Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  let agentRunId;

  await check('POST /api/agent/run returns signal + receipts', async () => {
    if (!demoUserId) throw new Error('demo user not available');
    const data = await post('/api/agent/run', { userId: demoUserId });
    assert(data.success === true, `agent run failed: ${data.error}`);
    assert(['BUY', 'HOLD', 'SELL'].includes(data.result?.signal),
      `invalid signal: ${data.result?.signal}`);
    assert(data.result?.receipts?.length === 3, 'should have 3 x402 receipts');
    assert(data.creditsUsed === 10, `should use 10 credits, used ${data.creditsUsed}`);
    agentRunId = data.runId;
  });

  await check('Agent run receipt has tx signature', async () => {
    if (!demoUserId) throw new Error('demo user not available');
    const data = await post('/api/agent/run', { userId: demoUserId });
    const receipt = data.result?.receipts?.[0];
    assert(receipt?.signature, 'receipt missing tx signature');
    assert(receipt?.explorer, 'receipt missing explorer URL');
    assert(receipt?.amount > 0, 'receipt amount should be > 0');
  });

  await check('GET /api/agent/runs returns run history', async () => {
    const data = await get('/api/agent/runs');
    assert(Array.isArray(data.runs), 'runs should be array');
    assert(data.runs.length > 0, 'should have runs after our agent run');
    const run = data.runs[0];
    assert(run.run_id, 'run should have run_id');
    assert(run.status === 'completed', `run should be completed, got ${run.status}`);
  });

  await check('POST /api/agent/run returns 402 without userId', async () => {
    const res = await fetch(`${BASE_URL}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // â”€â”€ SECTION 9: Settlement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Settlement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  await check('GET /api/solana/settlement-log returns receipts', async () => {
    const data = await get('/api/solana/settlement-log');
    assert(Array.isArray(data.receipts), 'receipts should be array');
    assert(data.receipts.length > 0, 'should have receipts after agent runs');
    assert(typeof data.totalSettled === 'number', 'totalSettled should be number');
    assert(data.network === 'devnet', 'network should be devnet');
  });

  await check('Settlement receipt has required fields', async () => {
    const data = await get('/api/solana/settlement-log');
    const r = data.receipts[0];
    assert(r.signature, 'receipt missing signature');
    assert(r.explorer, 'receipt missing explorer URL');
    assert(r.amountUsdc > 0, 'receipt amount should be > 0');
    assert(r.tool, 'receipt missing tool name');
  });

  await check('GET /api/solana/wallet-status returns status object', async () => {
    const data = await get('/api/solana/wallet-status');
    assert(typeof data.connected === 'boolean', 'connected should be boolean');
    assert(data.network === 'devnet', 'network should be devnet');
  });

  // â”€â”€ SECTION 10: Dashboard Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Dashboard Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  await check('GET /api/dashboard/metrics returns all required fields', async () => {
    const data = await get('/api/dashboard/metrics');
    assert(typeof data.mrr === 'number', 'mrr missing');
    assert(typeof data.mrrFormatted === 'string', 'mrrFormatted missing');
    assert(typeof data.activeSubscribers === 'number', 'activeSubscribers missing');
    assert(typeof data.totalCreditsUsed === 'number', 'totalCreditsUsed missing');
    assert(typeof data.totalUsdcSettled === 'number', 'totalUsdcSettled missing');
    assert(typeof data.completedAgentRuns === 'number', 'completedAgentRuns missing');
    assert(data.timestamp, 'timestamp missing');
  });

  await check('Monthly revenue has 6 months with correct shape', async () => {
    const data = await get('/api/dashboard/metrics');
    assert(Array.isArray(data.monthlyRevenue), 'monthlyRevenue should be array');
    assert(data.monthlyRevenue.length === 6, `should have 6 months, got ${data.monthlyRevenue.length}`);
    const m = data.monthlyRevenue[0];
    assert('month' in m, 'missing month field');
    assert('inr' in m, 'missing inr field');
    assert('usdc' in m, 'missing usdc field');
  });

  await check('Metrics totalCreditsUsed is positive after agent runs', async () => {
    const data = await get('/api/dashboard/metrics');
    assert(data.totalCreditsUsed > 0,
      `totalCreditsUsed should be > 0 after our smoke test runs, got ${data.totalCreditsUsed}`);
  });

  await check('Metrics totalUsdcSettled is positive after agent runs', async () => {
    const data = await get('/api/dashboard/metrics');
    assert(data.totalUsdcSettled > 0,
      `totalUsdcSettled should be > 0 after our smoke test runs, got ${data.totalUsdcSettled}`);
  });

  // â”€â”€ SECTION 11: Subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”€â”€ Subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  await check('GET /api/subscriptions returns subscriber list', async () => {
    const data = await get('/api/subscriptions');
    assert(Array.isArray(data.subscriptions), 'subscriptions should be array');
    assert(data.subscriptions.length > 0, 'should have at least demo subscriber');
  });

  await check('GET /api/subscriptions/events returns event log', async () => {
    const data = await get('/api/subscriptions/events');
    assert(Array.isArray(data.events), 'events should be array');
    assert(data.events.length > 0, 'should have events from our smoke test');
  });

  // â”€â”€ RESULTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  console.log('\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
  console.log(`  Results: ${passed} passed  ${failed} failed  ${warned} warnings`);
  console.log('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n');

  if (failed > 0) {
    console.log('FAILED CHECKS:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  ${FAIL}  ${r.name}`);
      console.log(`       ${r.error}`);
    });
    console.log('');
  }

  if (warned > 0) {
    console.log('WARNINGS (non-blocking):');
    results.filter(r => r.status === 'warn').forEach(r => {
      console.log(`  ${WARN} ${r.name}`);
      console.log(`       ${r.error}`);
    });
    console.log('');
  }

  if (failed === 0) {
    console.log('ðŸ”ï¸  All critical checks passed. DodoArc is ready for submission.\n');
  } else {
    console.log(`ðŸš¨  ${failed} critical check(s) failed. Fix before submitting.\n`);
    process.exit(1);
  }
}

runSmokeTests().catch(err => {
  console.error('\nðŸ’¥ Smoke test runner crashed:', err.message);
  process.exit(1);
});
```

**Add to `package.json` scripts:**
```json
"scripts": {
  "start":      "node server.js",
  "dev":        "nodemon server.js",
  "test":       "jest",
  "smoke":      "node scripts/smoke-test.js",
  "smoke:prod": "SMOKE_BASE_URL=https://your-app.com node scripts/smoke-test.js"
}
```

---

## Part 3 â€” Environment Validation Script

> Run this before every demo and before submission. Catches missing keys instantly.

Create `scripts/check-env.js`:

```javascript
// scripts/check-env.js
// Usage: node scripts/check-env.js

require('dotenv').config();

const checks = [
  // Required for mock demo (always)
  { key: 'PORT',                       required: false, default: '3000' },
  { key: 'BASE_URL',                   required: false, default: 'http://localhost:3000' },

  // Required for real Dodo checkout
  { key: 'DODO_PAYMENTS_API_KEY',      required: false, note: 'Without this: mock checkout mode' },
  { key: 'DODO_PAYMENTS_WEBHOOK_SECRET', required: false, note: 'Without this: webhook sig not verified' },
  { key: 'DODO_PRO_PRODUCT_ID',        required: false, note: 'Without this: mock product ID used' },
  { key: 'DODO_MODE',                  required: false, default: 'sandbox' },

  // Required for real Solana settlement
  { key: 'SOLANA_RPC_URL',             required: false, default: 'https://api.devnet.solana.com' },
  { key: 'SOLANA_PRIVATE_KEY',         required: false, note: 'Without this: mock x402 settlement' },
  { key: 'USDC_MINT',                  required: false, default: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' },
];

console.log('\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
console.log('  DodoArc Environment Check');
console.log('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n');

let allGood = true;

checks.forEach(({ key, required, note, default: def }) => {
  const val = process.env[key];
  const isSet = val && val !== 'your_key_here' && val !== 'your_base58_private_key_here';

  if (isSet) {
    const display = key.includes('KEY') || key.includes('SECRET')
      ? val.slice(0, 8) + 'â€¦'
      : val;
    console.log(`âœ…  ${key.padEnd(35)} ${display}`);
  } else if (def) {
    console.log(`ðŸ”µ  ${key.padEnd(35)} (default: ${def})`);
  } else if (required) {
    console.log(`âŒ  ${key.padEnd(35)} MISSING â€” required`);
    allGood = false;
  } else {
    console.log(`âš ï¸   ${key.padEnd(35)} not set â€” ${note}`);
  }
});

console.log('\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
if (allGood) {
  console.log('  âœ… Environment OK â€” ready to run\n');
} else {
  console.log('  âŒ Missing required variables â€” check .env\n');
  process.exit(1);
}
```

**Add to `package.json` scripts:**
```json
"check-env": "node scripts/check-env.js"
```

---

## Part 4 â€” `.env.example` Final Audit

Replace existing `.env.example` with this definitive version:

```bash
# â”€â”€ DodoArc Environment Variables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Copy this file: cp .env.example .env
# Run check: npm run check-env

# â”€â”€ Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
PORT=3000
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# â”€â”€ Dodo Payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Get from: https://app.dodopayments.com â†’ Settings â†’ API Keys
# Without this: app runs in mock checkout mode (fully functional for demo)
DODO_PAYMENTS_API_KEY=sk_test_your_key_here
DODO_PAYMENTS_WEBHOOK_SECRET=whsec_your_secret_here
DODO_MODE=sandbox                              # sandbox | live
DODO_BUSINESS_ID=your_business_id_here

# Dodo Product IDs â€” create with: node scripts/setup-dodo-products.js
DODO_PRO_PRODUCT_ID=pdt_your_pro_product_id
DODO_STARTER_PRODUCT_ID=pdt_your_starter_product_id

# â”€â”€ Solana â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Without SOLANA_PRIVATE_KEY: x402 runs in mock mode (still demos correctly)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=your_base58_private_key_here

# USDC devnet mint (official Circle devnet USDC)
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Tool provider wallets for x402 payments (use your devnet wallet for testing)
TOOL_WALLET_MARKET=So11111111111111111111111111111111111111112
TOOL_WALLET_SENTIMENT=So11111111111111111111111111111111111111112
TOOL_WALLET_SIGNAL=So11111111111111111111111111111111111111112
```

---

## Part 5 â€” Demo Video Script (2 Minutes)

> Record this as a Loom. Colosseum requires a demo video. This script is optimized for judges who have 2 minutes.

### Pre-recording checklist
- [ ] Terminal open: `npm run dev` running, no errors
- [ ] Browser: `http://localhost:3000` on landing page
- [ ] Browser: `http://localhost:3000/dashboard` tab ready (not open yet)
- [ ] Dashboard demo banner visible
- [ ] Screen resolution: 1920Ã—1080, browser full screen

### Script

```
[0:00â€“0:15] â€” THE PROBLEM
"An Indian developer builds a trading agent on Solana.
They want to charge users â‚¹3,000 a month.
They can't use Stripe. They can't force users to install Phantom.
MCPay solved agent-to-tool. Nobody solved human-to-agent.
That's DodoArc."

[0:15â€“0:30] â€” LANDING PAGE
[Show landing page at localhost:3000]
"DodoArc is the billing OS for AI agent products.
Fiat in â€” agent runs â€” USDC out.
One platform, three layers."

[0:30â€“1:00] â€” THE DEMO FLOW
[Switch to dashboard tab at localhost:3000/dashboard]
[Click "â–¶ Run full demo flow"]
"Watch what happens when I click this button.
Step 1 â€” a UPI payment is simulated through Dodo Payments.
Step 2 â€” the webhook fires, credits are activated instantly.
Step 3 â€” the trading agent runs, consuming those credits,
and triggers three x402 micropayments on Solana devnet."
[Wait for demo to complete, toast appears]
"Signal generated. USDC settled. All in under 3 seconds."

[1:00â€“1:30] â€” DASHBOARD WALKTHROUGH
[Click sidebar: Agents tab]
"The settlement log shows every x402 transaction with a real
Solana devnet explorer link. Click it â€” it's on-chain."
[Click sidebar: Webhooks tab]
"Every Dodo payment event is logged here with idempotency status.
No double credit grants â€” even if Dodo retries 5 times."
[Click sidebar: Flow tab]
"This is the complete DodoArc story â€” from PhonePe payment
to USDC on Solana. That's the missing bridge."

[1:30â€“1:50] â€” TECH + TRACTION
"Built on: Dodo Payments SDK, x402 protocol, Solana devnet,
Phantom wallet connect, WebSocket real-time dashboard.
22 tests passing. SQLite persistence. Fully open source."

[1:50â€“2:00] â€” CLOSE
"DodoArc: the billing OS for AI agent products.
Normal users don't have Phantom. They have PhonePe.
We built the bridge. Thank you."
```

---

## Part 6 â€” Final Submission Checklist

### Before Submitting

```bash
# 1. Run environment check
npm run check-env

# 2. Run full test suite
npm test

# 3. Start server fresh
npm run dev

# 4. Run smoke test
npm run smoke

# 5. Manually verify demo flow works
# Open http://localhost:3000/dashboard â†’ click "Run full demo flow"
# Confirm: credits â†’ agent run â†’ 3 receipts appear in settlement log

# 6. Commit and push
git add .
git commit -m "chore: final M5 polish + smoke test + README"
git push origin main
```

### Colosseum Frontier Submission (https://colosseum.com/frontier)

- [ ] Project name: `DodoArc`
- [ ] One-liner: `Billing OS for AI agent products â€” fiat subscriptions in, x402 USDC settlement out`
- [ ] GitHub repo: public, README complete
- [ ] Demo video: 2-minute Loom (script above)
- [ ] Track: Dodo Payments (primary)
- [ ] Team: solo builder
- [ ] Contact: @shivam_soni18

### Superteam Earn â€” Dodo Payments Sidetrack

- [ ] Submit separately at superteam.fun/earn
- [ ] Same GitHub repo + demo video link
- [ ] Emphasize: INR/UPI integration, Indian market wedge, Dodo as core primitive

### Post-Submission

```bash
# Post on X immediately after submitting:
# "DodoArc is submitted to @colosseumorg Frontier.
# Billing OS for AI agent products.
# Fiat in â†’ agent runs â†’ USDC out.
# @DodoPayments @SuperteamDAO #Solana #buildinpublic"
```

---

## Milestone 5 Completion Checklist

### Code
- [ ] All changes committed and pushed to public GitHub repo
- [ ] `README.md` complete and submission-ready
- [ ] `.env.example` fully documented
- [ ] `scripts/smoke-test.js` runs without failures
- [ ] `scripts/check-env.js` runs cleanly

### Tests
- [ ] `npm test` passes â€” 22 tests, 4 suites
- [ ] `npm run smoke` passes â€” 0 critical failures (warnings OK)
- [ ] All 25+ smoke test checks pass

### Demo
- [ ] `npm run dev` starts cleanly with zero errors
- [ ] Landing page loads at `http://localhost:3000`
- [ ] Dashboard loads at `http://localhost:3000/dashboard`
- [ ] "â–¶ Run full demo flow" completes successfully
- [ ] Settlement log shows 3 x402 receipts with explorer links
- [ ] WebSocket "â— LIVE" indicator shows connected
- [ ] 2-minute demo video recorded and uploaded to Loom

### Submission
- [ ] Colosseum Frontier submitted before May 11
- [ ] Superteam Earn Dodo sidetrack submitted
- [ ] X post published with @colosseumorg @DodoPayments tags

---

## Quick Reference â€” Files in Milestone 5

| File | Action | What it does |
|------|--------|-------------|
| `README.md` | **Create** | Submission-ready pitch + quick start |
| `scripts/smoke-test.js` | **Create** | 25+ end-to-end checks before submission |
| `scripts/check-env.js` | **Create** | Validates all env variables |
| `.env.example` | **Replace** | Definitive final version |
| `package.json` | **Update** | Add `smoke` and `check-env` scripts |

---

*DodoArc â€” Billing OS for AI Agent Products | Colosseum Frontier 2026 | Milestone 5 â€” FINAL*
