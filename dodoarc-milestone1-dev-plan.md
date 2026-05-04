# DodoArc — Milestone 1 Development Plan
## For Claude Code (Agentic Execution)

**Project:** DodoArc — Billing OS for AI Agent Products  
**Milestone 1 Goal:** Launch a live Dodo Payments checkout with a real INR subscription plan  
**Deadline:** ASAP (Colosseum Frontier submission: May 11, 2026)  
**Stack:** Node.js + Express + Dodo Payments SDK + Solana (devnet for now)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        DodoArc MVP                          │
├────────────┬────────────┬───────────────┬───────────────────┤
│  Frontend  │  Backend   │  Dodo Layer   │  Solana Layer     │
│  (HTML UI) │ (Express)  │  (Payments)   │  (Settlement)     │
├────────────┼────────────┼───────────────┼───────────────────┤
│ Landing    │ /api/plans │ Dodo Checkout │ Phantom wallet    │
│ Dashboard  │ /api/subs  │ Dodo Webhooks │ USDC token acct   │
│ Checkout   │ /api/creds │ Dodo Credits  │ x402 headers      │
└────────────┴────────────┴───────────────┴───────────────────┘
```

### Data Flow (Milestone 1 focus)
```
User → Dodo Checkout (INR/UPI) → Payment Success
     → Dodo Webhook POST /api/webhook/dodo
     → DodoArc verifies signature
     → Credits activated in DB
     → User access granted
     → Dashboard updated
```

---

## Directory Structure

```
dodoarc/
├── package.json
├── .env                        ← secrets (never commit)
├── .env.example                ← template (commit this)
├── server.js                   ← Express entry point
├── src/
│   ├── routes/
│   │   ├── plans.js            ← GET /api/plans
│   │   ├── subscriptions.js    ← GET/POST /api/subscriptions
│   │   ├── credits.js          ← GET /api/credits/:userId
│   │   ├── checkout.js         ← POST /api/checkout/create
│   │   └── webhook.js          ← POST /api/webhook/dodo
│   ├── services/
│   │   ├── dodo.js             ← Dodo Payments SDK wrapper
│   │   ├── credits.js          ← credit engine logic
│   │   ├── db.js               ← in-memory store (MVP)
│   │   └── solana.js           ← x402 settlement (Milestone 3)
│   ├── middleware/
│   │   └── verifyWebhook.js    ← Dodo webhook signature check
│   └── config.js               ← env variable exports
├── public/
│   ├── index.html              ← the HTML UI file (see below)
│   ├── checkout.html           ← standalone checkout page
│   └── assets/                 ← fonts, icons if needed
└── tests/
    ├── webhook.test.js
    └── credits.test.js
```

---

## Step 1 — Project Init

```bash
mkdir dodoarc && cd dodoarc
npm init -y
npm install express dotenv cors helmet morgan crypto-js
npm install @dodo-payments/sdk   # or use REST API if SDK unavailable
npm install @solana/web3.js      # for Milestone 3 x402
npm install -D nodemon jest
```

### package.json scripts
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  }
}
```

---

## Step 2 — Environment Variables

### .env.example (commit this)
```
# Dodo Payments
DODO_API_KEY=your_dodo_api_key_here
DODO_WEBHOOK_SECRET=your_webhook_secret_here
DODO_MODE=sandbox               # sandbox | live
DODO_BUSINESS_ID=your_business_id

# App
PORT=3000
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Solana (Milestone 3)
SOLANA_RPC_URL=https://api.devnet.solana.com
WALLET_PRIVATE_KEY=your_wallet_private_key_here
USDC_MINT_DEVNET=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Database (use SQLite for MVP, Postgres for production)
DB_PATH=./data/dodoarc.db
```

### .env (never commit — add to .gitignore)
```
# Fill in real values from Dodo Payments dashboard
DODO_API_KEY=sk_test_...
DODO_WEBHOOK_SECRET=whsec_...
```

---

## Step 3 — server.js (Entry Point)

```javascript
// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(morgan('dev'));

// IMPORTANT: Raw body needed for webhook signature verification
// Must be before express.json()
app.use('/api/webhook/dodo', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/plans',         require('./src/routes/plans'));
app.use('/api/subscriptions', require('./src/routes/subscriptions'));
app.use('/api/credits',       require('./src/routes/credits'));
app.use('/api/checkout',      require('./src/routes/checkout'));
app.use('/api/webhook',       require('./src/routes/webhook'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serve frontend for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`DodoArc running at http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.DODO_MODE || 'sandbox'}`);
});

module.exports = app;
```

---

## Step 4 — In-Memory Database (MVP)

```javascript
// src/services/db.js
// MILESTONE 1: Simple in-memory store. Replace with SQLite/Postgres later.

const store = {
  plans: [
    {
      id: 'plan_starter',
      name: 'Starter',
      price: 0,
      currency: 'INR',
      credits: 100,
      interval: 'monthly',
      dodo_product_id: null,    // fill after Dodo product creation
    },
    {
      id: 'plan_pro',
      name: 'Pro',
      price: 2999,
      currency: 'INR',
      credits: 1000,
      interval: 'monthly',
      dodo_product_id: null,    // fill after Dodo product creation
    }
  ],
  subscriptions: [],            // { id, userId, planId, status, credits_total, credits_used, created_at }
  users: [],                    // { id, email, name, created_at }
  events: [],                   // { type, data, timestamp } — for activity feed
};

module.exports = {
  // Plans
  getPlans: () => store.plans,
  getPlanById: (id) => store.plans.find(p => p.id === id),

  // Users
  getOrCreateUser: (email, name) => {
    let user = store.users.find(u => u.email === email);
    if (!user) {
      user = { id: `user_${Date.now()}`, email, name, created_at: new Date() };
      store.users.push(user);
    }
    return user;
  },
  getUserById: (id) => store.users.find(u => u.id === id),

  // Subscriptions
  createSubscription: (data) => {
    const sub = { id: `sub_${Date.now()}`, ...data, created_at: new Date() };
    store.subscriptions.push(sub);
    return sub;
  },
  getSubscriptionByUser: (userId) => store.subscriptions.find(s => s.userId === userId),
  updateSubscription: (id, updates) => {
    const idx = store.subscriptions.findIndex(s => s.id === id);
    if (idx !== -1) store.subscriptions[idx] = { ...store.subscriptions[idx], ...updates };
    return store.subscriptions[idx];
  },
  getAllSubscriptions: () => store.subscriptions,

  // Credits
  deductCredits: (userId, amount) => {
    const sub = store.subscriptions.find(s => s.userId === userId && s.status === 'active');
    if (!sub) return { success: false, error: 'No active subscription' };
    if ((sub.credits_total - sub.credits_used) < amount) return { success: false, error: 'Insufficient credits' };
    sub.credits_used += amount;
    return { success: true, remaining: sub.credits_total - sub.credits_used };
  },
  getRemainingCredits: (userId) => {
    const sub = store.subscriptions.find(s => s.userId === userId && s.status === 'active');
    if (!sub) return 0;
    return sub.credits_total - sub.credits_used;
  },

  // Events (for dashboard feed)
  logEvent: (type, data) => {
    const event = { type, data, timestamp: new Date() };
    store.events.unshift(event);
    if (store.events.length > 100) store.events.pop();
    return event;
  },
  getRecentEvents: (limit = 20) => store.events.slice(0, limit),
};
```

---

## Step 5 — Dodo Payments Service

```javascript
// src/services/dodo.js
// Dodo Payments API wrapper

const config = require('../config');

const DODO_BASE = config.DODO_MODE === 'live'
  ? 'https://api.dodopayments.com/v1'
  : 'https://test.dodopayments.com/v1';

const headers = {
  'Authorization': `Bearer ${config.DODO_API_KEY}`,
  'Content-Type': 'application/json',
};

async function request(method, path, body = null) {
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${DODO_BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Dodo API error: ${res.status}`);
  return data;
}

module.exports = {
  /**
   * Create a payment link for subscription
   * @param {Object} opts - { planId, customerEmail, customerName, amount, currency, metadata }
   */
  createPaymentLink: async (opts) => {
    return request('POST', '/payments', {
      billing: {
        city: 'Mumbai',
        country: 'IN',
        state: 'Maharashtra',
        street: '',
        zipcode: '400001',
      },
      customer: {
        email: opts.customerEmail,
        name: opts.customerName,
      },
      product_cart: [{
        product_id: opts.dodoProductId,
        quantity: 1,
      }],
      payment_link: true,
      return_url: `${config.BASE_URL}/payment-success?plan=${opts.planId}`,
      metadata: opts.metadata || {},
    });
  },

  /**
   * Create a Dodo product (run once during setup)
   */
  createProduct: async ({ name, price, currency = 'INR', description }) => {
    return request('POST', '/products', {
      name,
      description,
      price: {
        amount: price,       // in paise (INR): 299900 = ₹2,999
        currency,
        type: 'one_time',    // use 'recurring' for true subscriptions
      },
      tax_category: 'saas',
    });
  },

  /**
   * Get all subscriptions from Dodo
   */
  listSubscriptions: async () => {
    return request('GET', '/subscriptions');
  },

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature: (rawBody, signature, secret) => {
    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return `sha256=${expectedSig}` === signature;
  },
};
```

---

## Step 6 — Config

```javascript
// src/config.js
module.exports = {
  DODO_API_KEY:        process.env.DODO_API_KEY,
  DODO_WEBHOOK_SECRET: process.env.DODO_WEBHOOK_SECRET,
  DODO_MODE:           process.env.DODO_MODE || 'sandbox',
  DODO_BUSINESS_ID:    process.env.DODO_BUSINESS_ID,
  BASE_URL:            process.env.BASE_URL || 'http://localhost:3000',
  PORT:                process.env.PORT || 3000,
  SOLANA_RPC_URL:      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
};
```

---

## Step 7 — Routes

### plans.js
```javascript
// src/routes/plans.js
const router = require('express').Router();
const db = require('../services/db');

// GET /api/plans — return all available plans
router.get('/', (req, res) => {
  res.json({ plans: db.getPlans() });
});

// GET /api/plans/:id
router.get('/:id', (req, res) => {
  const plan = db.getPlanById(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan });
});

module.exports = router;
```

### checkout.js
```javascript
// src/routes/checkout.js
const router = require('express').Router();
const db = require('../services/db');
const dodo = require('../services/dodo');

// POST /api/checkout/create
// Body: { planId, email, name }
router.post('/create', async (req, res) => {
  try {
    const { planId, email, name } = req.body;
    if (!planId || !email) return res.status(400).json({ error: 'planId and email required' });

    const plan = db.getPlanById(planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Starter plan is free — no payment link needed
    if (plan.price === 0) {
      const user = db.getOrCreateUser(email, name);
      db.createSubscription({
        userId: user.id,
        planId,
        status: 'active',
        credits_total: plan.credits,
        credits_used: 0,
      });
      db.logEvent('subscription_created', { userId: user.id, planId, method: 'free' });
      return res.json({ success: true, type: 'free', user });
    }

    // Paid plan — create Dodo payment link
    const paymentLink = await dodo.createPaymentLink({
      planId,
      customerEmail: email,
      customerName: name || email,
      dodoProductId: plan.dodo_product_id,
      metadata: { planId, email, userId: db.getOrCreateUser(email, name).id },
    });

    db.logEvent('checkout_initiated', { email, planId, amount: plan.price });
    res.json({ success: true, type: 'paid', payment_url: paymentLink.payment_link });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

### webhook.js — THE MOST IMPORTANT ROUTE
```javascript
// src/routes/webhook.js
const router = require('express').Router();
const db = require('../services/db');
const dodo = require('../services/dodo');
const config = require('../config');

// POST /api/webhook/dodo
// Dodo sends payment events here
router.post('/dodo', async (req, res) => {
  try {
    // Step 1: Verify signature (CRITICAL — never skip this)
    const signature = req.headers['dodo-signature'] || req.headers['webhook-signature'];
    const rawBody = req.body;   // raw buffer (see server.js middleware setup)

    if (config.DODO_MODE === 'live') {
      const isValid = dodo.verifyWebhookSignature(rawBody, signature, config.DODO_WEBHOOK_SECRET);
      if (!isValid) {
        console.warn('Webhook signature invalid — rejected');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Step 2: Parse event
    const event = JSON.parse(rawBody.toString());
    console.log('Webhook received:', event.type, event.data?.id);
    db.logEvent('webhook_received', { type: event.type, id: event.data?.id });

    // Step 3: Handle event types
    switch (event.type) {

      case 'payment.succeeded': {
        const payment = event.data;
        const metadata = payment.metadata || {};
        const { planId, email } = metadata;

        if (!planId || !email) {
          console.warn('Missing metadata in payment event');
          break;
        }

        const plan = db.getPlanById(planId);
        const user = db.getOrCreateUser(email, metadata.name);
        const existingSub = db.getSubscriptionByUser(user.id);

        if (existingSub) {
          // Renewal: top up credits
          db.updateSubscription(existingSub.id, {
            status: 'active',
            credits_total: existingSub.credits_total + plan.credits,
          });
          db.logEvent('credits_topped_up', {
            userId: user.id, planId, added: plan.credits,
            amount: payment.amount, currency: payment.currency,
          });
        } else {
          // New subscription
          db.createSubscription({
            userId: user.id,
            planId,
            dodo_payment_id: payment.id,
            status: 'active',
            credits_total: plan.credits,
            credits_used: 0,
          });
          db.logEvent('subscription_activated', {
            userId: user.id, planId,
            amount: payment.amount, currency: payment.currency,
          });
        }
        console.log(`✅ Subscription activated for ${email} — Plan: ${planId}`);
        break;
      }

      case 'payment.failed': {
        const payment = event.data;
        const { email } = payment.metadata || {};
        if (email) {
          const user = db.getOrCreateUser(email, '');
          const sub = db.getSubscriptionByUser(user.id);
          if (sub) db.updateSubscription(sub.id, { status: 'paused' });
          db.logEvent('subscription_paused', { userId: user.id, reason: 'payment_failed' });
        }
        console.log('⚠️ Payment failed:', payment.id);
        break;
      }

      case 'subscription.cancelled': {
        db.logEvent('subscription_cancelled', { id: event.data?.id });
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    // Always return 200 quickly — Dodo retries if it doesn't get 200
    res.json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    // Still return 200 to prevent Dodo from retrying indefinitely
    res.json({ received: true, error: err.message });
  }
});

module.exports = router;
```

### credits.js
```javascript
// src/routes/credits.js
const router = require('express').Router();
const db = require('../services/db');

// GET /api/credits/:userId — check remaining credits
router.get('/:userId', (req, res) => {
  const sub = db.getSubscriptionByUser(req.params.userId);
  if (!sub) return res.json({ credits: 0, status: 'no_subscription' });
  res.json({
    credits_total: sub.credits_total,
    credits_used: sub.credits_used,
    credits_remaining: sub.credits_total - sub.credits_used,
    status: sub.status,
    planId: sub.planId,
  });
});

// POST /api/credits/consume — deduct credits (called by agent)
// Body: { userId, amount, agentName, action }
router.post('/consume', (req, res) => {
  const { userId, amount = 1, agentName, action } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const result = db.deductCredits(userId, amount);
  if (!result.success) return res.status(402).json({ error: result.error });

  db.logEvent('credits_consumed', { userId, amount, agentName, action });
  res.json({ success: true, consumed: amount, remaining: result.remaining });
});

module.exports = router;
```

### subscriptions.js
```javascript
// src/routes/subscriptions.js
const router = require('express').Router();
const db = require('../services/db');

// GET /api/subscriptions — all subscriptions (for dashboard)
router.get('/', (req, res) => {
  const subs = db.getAllSubscriptions();
  const enriched = subs.map(s => ({
    ...s,
    user: db.getUserById(s.userId),
    plan: db.getPlanById(s.planId),
    credits_remaining: s.credits_total - s.credits_used,
  }));
  res.json({ subscriptions: enriched, total: subs.length });
});

// GET /api/subscriptions/events — dashboard activity feed
router.get('/events', (req, res) => {
  res.json({ events: db.getRecentEvents(30) });
});

module.exports = router;
```

---

## Step 8 — Dodo Setup (One-Time)

Before running the app, you need to create products in Dodo dashboard:

```javascript
// scripts/setup-dodo-products.js
// Run once: node scripts/setup-dodo-products.js

require('dotenv').config();
const dodo = require('./src/services/dodo');

async function setup() {
  console.log('Creating Dodo products...');

  const pro = await dodo.createProduct({
    name: 'DodoArc Pro',
    description: 'DodoArc Pro: 1,000 agent credits per month, unlimited agents, x402 settlement',
    price: 299900,              // ₹2,999 in paise
    currency: 'INR',
  });
  console.log('Pro product created:', pro.id);
  console.log('→ Set plan_pro.dodo_product_id =', pro.id, 'in db.js');

  // Also configure webhook in Dodo dashboard:
  // URL: https://your-ngrok-url.ngrok.io/api/webhook/dodo
  // Events: payment.succeeded, payment.failed, subscription.cancelled
}

setup().catch(console.error);
```

---

## Step 9 — Integrate HTML UI with Backend

**This is how the HTML file (dodoarc-ui.html) connects to the Express backend:**

### 9.1 — Copy the UI file
```bash
# Copy the provided HTML UI file into the public folder
cp dodoarc-ui.html public/index.html
```

### 9.2 — Dashboard data — replace static values with live API calls

Add this `<script>` block at the bottom of `public/index.html`, replacing the static mock data:

```javascript
// At the bottom of index.html, before </body>
// Replace static dashboard data with live API calls

async function loadDashboardData() {
  try {
    const [subsRes, eventsRes] = await Promise.all([
      fetch('/api/subscriptions'),
      fetch('/api/subscriptions/events'),
    ]);
    const { subscriptions, total } = await subsRes.json();
    const { events } = await eventsRes.json();

    // Update metric cards
    const active = subscriptions.filter(s => s.status === 'active').length;
    const totalCreditsUsed = subscriptions.reduce((sum, s) => sum + (s.credits_used || 0), 0);

    // Update DOM
    document.querySelector('.metric-value[data-key="subscribers"]')
      && (document.querySelector('.metric-value[data-key="subscribers"]').textContent = active);
    document.querySelector('.metric-value[data-key="credits"]')
      && (document.querySelector('.metric-value[data-key="credits"]').textContent = totalCreditsUsed.toLocaleString());

    // Update subscriber table
    renderSubscriberTable(subscriptions);
    renderEventFeed(events);
  } catch (err) {
    console.warn('Could not load live data, using mock data:', err.message);
  }
}

function renderSubscriberTable(subs) {
  const tbody = document.querySelector('.sub-table tbody');
  if (!tbody || !subs.length) return;
  tbody.innerHTML = subs.slice(0, 6).map(s => `
    <tr>
      <td>${s.user?.email || 'Unknown'}</td>
      <td>${s.plan?.name || s.planId} · ${s.plan?.price ? '₹' + s.plan.price + '/mo' : 'Free'}</td>
      <td>UPI</td>
      <td>${s.credits_remaining || 0} / ${s.credits_total || 0}</td>
      <td><span class="status-pill sp-${s.status === 'active' ? 'active' : s.status === 'paused' ? 'paused' : 'trial'}">${s.status}</span></td>
      <td>${new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</td>
    </tr>
  `).join('');
}

function renderEventFeed(events) {
  const feed = document.querySelector('.agent-flow');
  if (!feed || !events.length) return;
  feed.innerHTML = events.slice(0, 5).map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dotColor = e.type.includes('credit') ? 'green' : e.type.includes('payment') ? 'gold' : 'blue';
    const amount = e.data?.amount ? `${e.data.currency || ''} ${e.data.amount}` : e.data?.added ? `+${e.data.added} cr` : '';
    return `
      <div class="agent-event ae-row-active">
        <span class="ae-time">${time}</span>
        <span class="ae-dot ${dotColor}"></span>
        <span class="ae-text">${e.type.replace(/_/g, ' ')}</span>
        <span class="ae-amount">${amount}</span>
      </div>
    `;
  }).join('');
}

// Load on page focus (dashboard section visible)
loadDashboardData();
setInterval(loadDashboardData, 15000);  // refresh every 15s
```

### 9.3 — Wire the "Get started" buttons to real checkout

Add this to the script block:
```javascript
// Wire plan buttons to real checkout
document.querySelectorAll('.plan-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const planId = btn.dataset.planId;  // add data-plan-id attr to each button in HTML
    if (!planId) return;
    const email = prompt('Enter your email to get started:');
    if (!email) return;

    const res = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, email }),
    });
    const data = await res.json();
    if (data.payment_url) {
      window.open(data.payment_url, '_blank');  // Dodo checkout opens in new tab
    } else if (data.success && data.type === 'free') {
      alert('✅ Starter plan activated! Check your dashboard.');
      loadDashboardData();
    }
  });
});
```

### 9.4 — Add data-plan-id to buttons in HTML

In `public/index.html`, update the plan buttons:
```html
<!-- Find these buttons and add data-plan-id attribute -->
<button class="plan-btn btn-starter" data-plan-id="plan_starter">Get started free</button>
<button class="plan-btn btn-pro"     data-plan-id="plan_pro">Start Pro trial</button>
<button class="plan-btn btn-enterprise" data-plan-id="plan_enterprise">Contact us</button>
```

---

## Step 10 — Local Testing with ngrok

Dodo needs a public URL for webhooks. Use ngrok:

```bash
# Terminal 1 — run the server
npm run dev

# Terminal 2 — expose to internet
npx ngrok http 3000

# Copy the https URL (e.g., https://abc123.ngrok.io)
# Go to Dodo dashboard → Webhooks → Add endpoint:
#   URL: https://abc123.ngrok.io/api/webhook/dodo
#   Events: payment.succeeded, payment.failed
# Copy the webhook secret → paste into .env as DODO_WEBHOOK_SECRET
```

---

## Step 11 — Test the Full Flow

```bash
# 1. Start server
npm run dev

# 2. Open http://localhost:3000
# 3. Click "Start Pro trial" on the Pro plan card
# 4. Enter any email
# 5. Dodo sandbox checkout opens → use test card: 4111 1111 1111 1111
# 6. Payment succeeds → webhook fires to your ngrok URL
# 7. Check server logs for "✅ Subscription activated"
# 8. Dashboard auto-refreshes and shows new subscriber

# Manual webhook test (without real payment):
curl -X POST http://localhost:3000/api/webhook/dodo \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment.succeeded",
    "data": {
      "id": "pay_test_001",
      "amount": 299900,
      "currency": "INR",
      "metadata": {
        "planId": "plan_pro",
        "email": "test@example.com",
        "name": "Test User"
      }
    }
  }'

# Check credits
curl http://localhost:3000/api/subscriptions
```

---

## Milestone 1 Completion Checklist

- [ ] `npm run dev` starts without errors
- [ ] `GET /api/plans` returns plan list
- [ ] `POST /api/checkout/create` with `plan_pro` + email returns a Dodo payment URL
- [ ] Dodo checkout page opens in browser (sandbox mode)
- [ ] Test payment completes (sandbox card)
- [ ] Webhook fires to ngrok URL and logs "✅ Subscription activated"
- [ ] `GET /api/subscriptions` shows new subscriber
- [ ] Dashboard page shows updated subscriber count
- [ ] Starter plan activates immediately without payment
- [ ] Credit deduction works: `POST /api/credits/consume`

---

## What Comes Next (Milestones 2–5 Preview)

**Milestone 2** — Polish webhook reliability: retry queue, idempotency keys, Dodo webhook dashboard verification  
**Milestone 3** — x402 integration: `src/services/solana.js` + x402 middleware that triggers USDC transfer when agent calls tool  
**Milestone 4** — Connect all dashboard data live: WebSocket for real-time event feed, Chart.js for revenue graph  
**Milestone 5** — Demo polish: clean up UI, record 2-min demo video, submit to Colosseum Frontier + Dodo sidetrack on Superteam Earn  

---

## Quick Reference

| Route | Method | What it does |
|-------|--------|--------------|
| `/api/plans` | GET | List all plans |
| `/api/checkout/create` | POST | Create Dodo payment link |
| `/api/webhook/dodo` | POST | Receive Dodo payment events |
| `/api/credits/:userId` | GET | Check credits remaining |
| `/api/credits/consume` | POST | Deduct credits (agent calls this) |
| `/api/subscriptions` | GET | All subscriptions (dashboard) |
| `/api/subscriptions/events` | GET | Recent activity feed |
| `/api/health` | GET | Health check |

---

*DodoArc — Billing OS for AI Agent Products | Colosseum Frontier 2026*
