# DodoArc â€” Milestone 4 Development Plan
## For Claude Code (Agentic Execution)

**Milestone 4 Goal:** Build a lightweight dashboard showing subscriptions, credit usage, fiat revenue, and settlement visibility â€” all live, real data, zero mock values
**Current State:** Milestone 3 complete â€” 16 tests passing, agent runs work, x402 mock settlement, wallet connect API, SQLite receipts stored
**Deadline:** May 11, 2026 (Colosseum Frontier)

---

## What Milestone 4 Delivers

| # | Deliverable | Why It Matters for Judges |
|---|-------------|--------------------------|
| 1 | **All dashboard widgets wired to real DB** | Zero hardcoded numbers â€” every metric is live from SQLite |
| 2 | **Real-time auto-refresh (WebSocket)** | Judges see dashboard update live during demo |
| 3 | **Revenue chart from real subscription data** | Actual INR revenue visualized, not static bars |
| 4 | **Credit usage bars from real user data** | Shows real deduction per agent run |
| 5 | **Fiat â†’ USDC flow visualization** | One screen that tells the complete DodoArc story visually |
| 6 | **Run Agent button wired to real userId** | Works end-to-end without manual `userId` input |
| 7 | **Demo mode: one-click full flow** | Judge clicks one button â€” sees payment â†’ credits â†’ agent â†’ settlement |
| 8 | **Polish: loading states, error states, empty states** | Production-quality UX â€” no broken states during demo |

---

## Current Dashboard Gaps (What's Broken or Mocked Right Now)

Before building, Claude Code must audit these specific files and fix each gap:

```
public/dashboard.js â€” audit these functions:
  âœ— calcRevenue()        â†’ returns mock math, not real subscription data
  âœ— calcSettled()        â†’ returns Math.random() â€” replace with API call
  âœ— revenueChartWidget() â†’ static hardcoded bar heights [35,42,38,55,62,68]
  âœ— settlementWidget()   â†’ does not fetch live data on overview load
  âœ— runDemoAgent()       â†’ uses hardcoded 'demo_user_001' â€” needs real user

public/dashboard.html â€” audit:
  âœ— No loading skeleton states
  âœ— No error boundary when API fails
  âœ— No empty state messaging when tables have 0 rows
```

---

## Part 1 â€” Fix All Mock Data in `public/dashboard.js`

### Step 1.1 â€” Expand the API object

Replace the existing `API` object at the top of `dashboard.js` with this complete version:

```javascript
// public/dashboard.js â€” complete API object (replace existing)

const API = {
  subscriptions:  () => fetch('/api/subscriptions').then(r => r.json()),
  events:         () => fetch('/api/subscriptions/events').then(r => r.json()),
  credits:        (id) => fetch(`/api/credits/${id}`).then(r => r.json()),
  webhookLog:     () => fetch('/api/webhooks/log').then(r => r.json()),
  settlement:     () => fetch('/api/solana/settlement-log').then(r => r.json()),
  agentRuns:      () => fetch('/api/agent/runs').then(r => r.json()),
  walletStatus:   () => fetch('/api/solana/wallet-status').then(r => r.json()),
  plans:          () => fetch('/api/plans').then(r => r.json()),
  metrics:        () => fetch('/api/dashboard/metrics').then(r => r.json()),  // new in M4
  runAgent: (userId) => fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, agentName: 'Trading Signal Agent' }),
  }).then(r => r.json()),
};
```

### Step 1.2 â€” Add `/api/dashboard/metrics` Backend Route

This single endpoint aggregates all dashboard numbers. Add to `src/routes/subscriptions.js` (or create `src/routes/metrics.js`):

```javascript
// GET /api/dashboard/metrics
// Returns all numbers the dashboard needs in one request

router.get('/metrics', (req, res) => {
  const subs = db.getAllSubscriptions();
  const events = db.getRecentEvents(100);
  const settlements = db.getRecentSettlements();
  const runs = db.getRecentRuns();

  // Fiat revenue: sum of active paid subscriptions
  const paidSubs = subs.filter(s => s.status === 'active' && s.plan?.price > 0);
  const mrr = paidSubs.reduce((sum, s) => sum + (s.plan?.price || 0), 0);

  // Credits
  const totalCreditsUsed = subs.reduce((sum, s) => sum + (s.credits_used || 0), 0);
  const totalCreditsGranted = subs.reduce((sum, s) => sum + (s.credits_total || 0), 0);

  // USDC settled
  const totalUsdcSettled = settlements.reduce((sum, r) => sum + (r.amount_usdc || 0), 0);

  // Agent runs
  const completedRuns = runs.filter(r => r.status === 'completed').length;

  // Revenue by month (last 6 months from events)
  const monthlyRevenue = buildMonthlyRevenue(events);

  res.json({
    mrr,                          // â‚¹ monthly recurring revenue
    mrrFormatted: formatInr(mrr),
    activeSubscribers: paidSubs.length,
    totalSubscribers: subs.length,
    totalCreditsUsed,
    totalCreditsGranted,
    totalUsdcSettled: parseFloat(totalUsdcSettled.toFixed(6)),
    completedAgentRuns: completedRuns,
    monthlyRevenue,               // array of { month, inr, usdc }
    timestamp: new Date().toISOString(),
  });
});

function formatInr(paise) {
  if (paise >= 100000) return 'â‚¹' + (paise / 100000).toFixed(1) + 'L';
  if (paise >= 1000) return 'â‚¹' + (paise / 1000).toFixed(1) + 'K';
  return 'â‚¹' + paise;
}

function buildMonthlyRevenue(events) {
  // Build last 6 months skeleton
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      month: d.toLocaleString('en-IN', { month: 'short' }),
      inr: 0,
      usdc: 0,
    });
  }
  // Add real data from subscription_activated events
  events.forEach(e => {
    if (e.type !== 'subscription_activated' && e.type !== 'credits_topped_up') return;
    const eDate = new Date(e.timestamp);
    const eMonth = eDate.toLocaleString('en-IN', { month: 'short' });
    const target = months.find(m => m.month === eMonth);
    if (target && e.data?.amount) target.inr += e.data.amount / 100; // paise â†’ rupees
  });
  return months;
}
```

**Register in `server.js`:**
```javascript
// Add this line with other route registrations:
app.use('/api/dashboard', require('./src/routes/metrics'));
```

**Create `src/routes/metrics.js`** with the above content + these imports at top:
```javascript
const router = require('express').Router();
const db = require('../services/db');
module.exports = router;
```

### Step 1.3 â€” Fix `calcRevenue()` in `dashboard.js`

Remove `calcRevenue()` and `calcSettled()` functions entirely. Replace them with data from the metrics API. Update the `overview` view:

```javascript
// Replace the overview view function entirely:

overview: async () => {
  // Single metrics fetch â€” one round trip
  const [metrics, { events = [] }, { receipts = [] }] = await Promise.all([
    API.metrics(),
    API.events(),
    API.settlement(),
  ]);

  const { subscriptions = [] } = await API.subscriptions();

  return `
    <div class="dash-page-title">Overview</div>
    <div class="dash-page-sub" style="margin-bottom:1.25rem;">
      <span class="live-dot"></span>
      Last updated ${new Date(metrics.timestamp).toLocaleTimeString('en-IN')}
    </div>

    <div class="metrics-row">
      ${metricCard('MRR (Fiat)',          metrics.mrrFormatted,                      'â†‘ active subscriptions', 'up')}
      ${metricCard('Active Subscribers',  metrics.activeSubscribers,                 metrics.totalSubscribers + ' total', 'up')}
      ${metricCard('Credits Consumed',    metrics.totalCreditsUsed.toLocaleString(), metrics.completedAgentRuns + ' agent runs', 'flat')}
      ${metricCard('USDC Settled',        '$' + metrics.totalUsdcSettled.toFixed(4), 'via x402 Â· devnet', 'up')}
    </div>

    <div class="dash-grid2" style="margin-top:1rem;">
      ${revenueChartWidget(metrics.monthlyRevenue)}
      ${agentFeedWidget(events)}
      ${creditUsageWidget(subscriptions)}
      ${settlementWidgetLive(receipts)}
    </div>

    ${subscriberTableWidget(subscriptions)}
  `;
},
```

### Step 1.4 â€” Fix `revenueChartWidget()` to Use Real Data

```javascript
// Replace existing revenueChartWidget() with:

function revenueChartWidget(monthlyRevenue = []) {
  // Scale bars to max value
  const maxInr  = Math.max(...monthlyRevenue.map(m => m.inr), 1);
  const maxUsdc = Math.max(...monthlyRevenue.map(m => m.usdc), 1);
  const maxH = 70; // max bar height in px

  const bars = monthlyRevenue.map(m => `
    <div class="bar-group">
      <div class="bar revenue"    style="height:${Math.max(4, Math.round((m.inr  / maxInr)  * maxH))}px;" title="â‚¹${m.inr}"></div>
      <div class="bar settlement" style="height:${Math.max(4, Math.round((m.usdc / maxUsdc) * maxH))}px;" title="${m.usdc} USDC"></div>
      <div class="bar-month">${m.month}</div>
    </div>`).join('');

  return `<div class="dash-widget">
    <div class="widget-title">Revenue (6 months) <span class="widget-badge wb-live">Live</span></div>
    <div class="mini-chart">${bars || '<div style="font-size:0.75rem;color:var(--ink-soft);">No revenue data yet.</div>'}</div>
    <div style="display:flex;gap:12px;margin-top:8px;">
      <div style="display:flex;align-items:center;gap:4px;font-size:0.65rem;color:var(--ink-soft);">
        <span style="width:8px;height:8px;background:var(--olive);border-radius:2px;display:inline-block;"></span> Fiat (INR)
      </div>
      <div style="display:flex;align-items:center;gap:4px;font-size:0.65rem;color:var(--ink-soft);">
        <span style="width:8px;height:8px;background:var(--lavender);border-radius:2px;display:inline-block;"></span> USDC settled
      </div>
    </div>
  </div>`;
}
```

### Step 1.5 â€” Fix `settlementWidgetLive()` to Accept Pre-Fetched Data

```javascript
// Replace existing settlementWidget/settlementWidgetLive:

function settlementWidgetLive(receipts = []) {
  const total = receipts.reduce((s, r) => s + (r.amountUsdc || 0), 0);

  const rows = receipts.slice(0, 4).map(r => `
    <div class="settlement-row">
      <div>
        <a href="${r.explorer}" target="_blank" class="settle-hash">
          ${r.signature?.slice(0, 10)}â€¦â†—
        </a>
        <div style="font-size:0.65rem;color:var(--ink-soft);">
          ${r.tool || 'tool'} Â· ${new Date(r.timestamp).toLocaleTimeString('en-IN')}
        </div>
      </div>
      <div class="settle-amount">${r.amountUsdc?.toFixed(4)} USDC</div>
      <div class="settle-status">âœ“ ${r.mock ? 'mock' : 'devnet'}</div>
    </div>`).join('');

  return `<div class="dash-widget">
    <div class="widget-title">
      Solana Settlements (x402)
      <span class="widget-badge wb-sync">On-chain</span>
    </div>
    ${rows || '<div style="font-size:0.75rem;color:var(--ink-soft);padding:0.5rem 0;">No settlements yet â€” run an agent to trigger x402.</div>'}
    ${total > 0 ? `
      <div style="margin-top:10px;padding:6px 8px;background:var(--olive-mist);border-radius:var(--r-sm);display:flex;justify-content:space-between;">
        <span style="font-size:0.7rem;color:var(--olive-dark);font-weight:500;">Total settled</span>
        <span style="font-family:'DM Mono',monospace;font-size:0.75rem;color:var(--olive-dark);font-weight:600;">${total.toFixed(4)} USDC</span>
      </div>` : ''}
  </div>`;
}
```

---

## Part 2 â€” Real-Time Auto-Refresh via WebSocket

> **Why:** Static dashboards look dead. During the demo, a judge triggers an agent run and the dashboard updates live without a page reload. This is the single most impressive visual moment of the entire demo.

### Step 2.1 â€” Add WebSocket to `server.js`

```javascript
// server.js â€” add WebSocket support

const { WebSocketServer } = require('ws');
// npm install ws

// After app.listen():
const server = app.listen(PORT, () => {
  console.log(`DodoArc running at http://localhost:${PORT}`);
});

// WebSocket server on same port
const wss = new WebSocketServer({ server });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  // Send ping every 30s to keep connection alive
  const ping = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping();
  }, 30000);
  ws.on('close', () => clearInterval(ping));
});

// Export broadcaster â€” other routes call this to push updates
app.locals.broadcast = (eventType, data) => {
  const msg = JSON.stringify({ type: eventType, data, timestamp: new Date() });
  wsClients.forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
};

module.exports = { app, server };
```

**Install ws:**
```bash
npm install ws
```

### Step 2.2 â€” Broadcast Events from Key Routes

In `src/routes/webhook.js`, after successful processing:
```javascript
// After db.markWebhookProcessed(...):
req.app.locals.broadcast('subscription_update', {
  type: event.type,
  email: metadata?.email,
  planId: metadata?.planId,
  action: actionTaken,
});
```

In `src/routes/agent.js`, after agent run completes:
```javascript
// After db.completeAgentRun(...):
req.app.locals.broadcast('agent_run_complete', {
  runId,
  signal: result.signal,
  creditsUsed: 10,
  usdcSettled: result.totalUsdcSettled,
});
```

### Step 2.3 â€” WebSocket Client in `dashboard.js`

Add at the bottom of `dashboard.js`, after all other code:

```javascript
// â”€â”€ WebSocket: live dashboard updates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function initWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    console.log('[WS] Connected â€” live updates active');
    document.getElementById('live-indicator').textContent = 'â— LIVE';
    document.getElementById('live-indicator').style.color = 'var(--olive)';
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWsMessage(msg);
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    document.getElementById('live-indicator').textContent = 'â—‹ reconnectingâ€¦';
    document.getElementById('live-indicator').style.color = 'var(--ink-soft)';
    // Reconnect after 3 seconds
    setTimeout(initWebSocket, 3000);
  };
}

function handleWsMessage(msg) {
  // Flash the live indicator
  const indicator = document.getElementById('live-indicator');
  indicator.style.color = 'var(--gold)';
  setTimeout(() => { indicator.style.color = 'var(--olive)'; }, 600);

  // Refresh the current view to show new data
  switch (msg.type) {
    case 'subscription_update':
      if (currentView === 'overview' || currentView === 'subscribers') {
        renderView(currentView);
      }
      // Show a non-intrusive toast
      showToast(`ðŸ’³ Payment received â€” ${msg.data?.email || 'subscriber'} activated`);
      break;

    case 'agent_run_complete':
      if (currentView === 'overview' || currentView === 'agents') {
        renderView(currentView);
      }
      showToast(`ðŸ¤– Agent run complete â€” ${msg.data?.signal} signal Â· ${msg.data?.usdcSettled?.toFixed(4)} USDC settled`);
      break;
  }
}

// Toast notification
function showToast(message) {
  const existing = document.getElementById('dodoarc-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'dodoarc-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%);
    background:var(--ink); color:var(--cream);
    padding:0.6rem 1.25rem; border-radius:100px;
    font-family:'Instrument Sans',sans-serif; font-size:0.8rem; font-weight:500;
    z-index:999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
    animation:toast-in 0.3s ease;
    white-space:nowrap;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.style.opacity = '0', 3000);
  setTimeout(() => toast.remove(), 3500);
}

// Add toast animation to dashboard.html <style>:
// @keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }

// Init WebSocket on page load
initWebSocket();
```

---

## Part 3 â€” Demo Mode: One-Click Full Flow

> **The most important UX feature for the hackathon demo.** Judge opens dashboard, clicks one button, sees the entire DodoArc flow in 30 seconds.

### Step 3.1 â€” Add Demo Banner to `dashboard.html`

Add this below the topbar and above `db-body`:

```html
<!-- Demo mode banner â€” shown when no real subscribers exist -->
<div id="demo-banner" style="
  background:var(--lavender-pale); border-bottom:1px solid var(--lavender-light);
  padding:0.6rem 1.5rem; display:flex; align-items:center; justify-content:space-between;
  font-size:0.78rem; color:var(--lavender-dark);
">
  <span>
    <strong>Demo mode</strong> â€” No real Dodo API key configured.
    The full flow works end-to-end with mock checkout + real credit engine + mock x402 settlement.
  </span>
  <button id="run-full-demo-btn" onclick="runFullDemo()" style="
    background:var(--lavender-dark); color:var(--white);
    border:none; border-radius:100px; padding:0.4rem 1rem;
    font-size:0.75rem; font-weight:600; cursor:pointer;
  ">â–¶ Run full demo flow</button>
</div>
```

### Step 3.2 â€” `runFullDemo()` Function in `dashboard.js`

```javascript
// public/dashboard.js

async function runFullDemo() {
  const btn = document.getElementById('run-full-demo-btn');
  btn.textContent = 'Runningâ€¦';
  btn.disabled = true;

  try {
    // Step 1: Simulate a payment (mock webhook)
    showToast('Step 1/3 â€” Simulating UPI payment via Dodoâ€¦');
    await fetch('/api/demo/simulate-payment', { method: 'POST' });
    await sleep(1200);

    // Step 2: Run agent (consumes credits, triggers x402)
    showToast('Step 2/3 â€” Running Trading Signal Agentâ€¦');
    const demoUser = await getDemoUser();
    const runResult = await API.runAgent(demoUser.id);
    await sleep(1200);

    // Step 3: Refresh dashboard
    showToast(`Step 3/3 â€” ${runResult.result?.signal} signal Â· ${runResult.result?.totalUsdcSettled?.toFixed(4)} USDC settled âœ“`);
    await renderView('overview');

  } catch (err) {
    showToast('Demo error: ' + err.message);
  } finally {
    btn.textContent = 'â–¶ Run full demo flow';
    btn.disabled = false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getDemoUser() {
  // Get or create demo user via API
  const res = await fetch('/api/demo/user').then(r => r.json());
  return res.user;
}
```

### Step 3.3 â€” Add Demo Routes to Backend

Create `src/routes/demo.js`:

```javascript
// src/routes/demo.js
// Demo-only routes for hackathon presentation
// These simulate a real Dodo payment event so the demo flow works without real API keys

const router = require('express').Router();
const db = require('../services/db');

// GET /api/demo/user â€” get or create the demo user with active subscription
router.get('/user', (req, res) => {
  const email = 'demo@dodoarc.xyz';
  const user = db.getOrCreateUser(email, 'Demo User');

  // Ensure demo user has an active subscription with credits
  let sub = db.getSubscriptionByUser(user.id);
  if (!sub) {
    db.createSubscription({
      userId: user.id,
      planId: 'plan_pro',
      status: 'active',
      credits_total: 500,
      credits_used: 0,
    });
    sub = db.getSubscriptionByUser(user.id);
  }

  // Top up if running low
  if ((sub.credits_total - sub.credits_used) < 20) {
    db.updateSubscription(sub.id, {
      status: 'active',
      credits_total: sub.credits_total + 200,
    });
  }

  res.json({ user, sub: db.getSubscriptionByUser(user.id) });
});

// POST /api/demo/simulate-payment â€” fire a mock payment.succeeded webhook
router.post('/simulate-payment', async (req, res) => {
  const email = 'demo@dodoarc.xyz';
  const planId = 'plan_pro';
  const plan = db.getPlanById(planId);
  const user = db.getOrCreateUser(email, 'Demo User');

  // Simulate exactly what the real webhook handler does
  let sub = db.getSubscriptionByUser(user.id);
  if (sub) {
    db.updateSubscription(sub.id, {
      status: 'active',
      credits_total: sub.credits_total + plan.credits,
    });
    db.logEvent('credits_topped_up', {
      userId: user.id, planId, added: plan.credits,
      amount: plan.price * 100, currency: 'INR',
    });
  } else {
    db.createSubscription({
      userId: user.id,
      planId,
      status: 'active',
      credits_total: plan.credits,
      credits_used: 0,
    });
    db.logEvent('subscription_activated', {
      userId: user.id, planId,
      amount: plan.price * 100, currency: 'INR',
    });
  }

  // Broadcast to dashboard via WebSocket
  req.app.locals.broadcast?.('subscription_update', {
    type: 'payment.succeeded',
    email,
    planId,
    action: 'demo_payment_simulated',
  });

  res.json({ success: true, user, planId });
});

module.exports = router;
```

**Register in `server.js`:**
```javascript
app.use('/api/demo', require('./src/routes/demo'));
```

---

## Part 4 â€” Polish: Loading, Error, and Empty States

### Step 4.1 â€” Loading Skeleton in `dashboard.js`

Replace the simple "Loadingâ€¦" string in `renderView()`:

```javascript
async function renderView(viewName) {
  if (!views[viewName]) return;
  currentView = viewName;

  // Show skeleton loader immediately
  mainEl.innerHTML = skeletonLoader();

  try {
    const html = await views[viewName]();
    mainEl.innerHTML = html;
  } catch (err) {
    mainEl.innerHTML = errorState(err.message);
  }

  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewName);
  });
}

function skeletonLoader() {
  return `
    <div style="animation:skeleton-pulse 1.5s ease-in-out infinite;">
      <div style="height:28px;width:160px;background:var(--cream-dark);border-radius:var(--r-sm);margin-bottom:0.5rem;"></div>
      <div style="height:14px;width:220px;background:var(--cream-dark);border-radius:var(--r-sm);margin-bottom:1.5rem;opacity:0.5;"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1rem;">
        ${[1,2,3,4].map(() => `<div style="height:80px;background:var(--cream-dark);border-radius:var(--r-md);"></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        ${[1,2,3,4].map(() => `<div style="height:160px;background:var(--cream-dark);border-radius:var(--r-md);"></div>`).join('')}
      </div>
    </div>`;
}

function errorState(message) {
  return `
    <div style="padding:3rem;text-align:center;">
      <div style="font-size:2rem;margin-bottom:1rem;">âš ï¸</div>
      <div style="font-size:0.9rem;font-weight:500;color:var(--ink);margin-bottom:0.5rem;">Failed to load dashboard</div>
      <div style="font-size:0.78rem;color:var(--ink-soft);margin-bottom:1.5rem;">${message}</div>
      <button onclick="renderView('${currentView}')" style="
        background:var(--olive);color:var(--white);border:none;
        border-radius:100px;padding:0.5rem 1.25rem;
        font-size:0.8rem;font-weight:600;cursor:pointer;
      ">Try again</button>
    </div>`;
}
```

Add this CSS to `dashboard.html`:
```html
<style>
  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .live-dot::before {
    content: 'â—'; color: var(--olive); margin-right: 4px;
    animation: pulse-dot 2s ease-in-out infinite;
    display: inline-block;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>
```

### Step 4.2 â€” Hide Demo Banner When Real Keys Are Set

Add to `dashboard.js` on init:

```javascript
// Check if real Dodo key is configured â€” hide demo banner if so
fetch('/api/health')
  .then(r => r.json())
  .then(data => {
    const banner = document.getElementById('demo-banner');
    if (banner && data.dodoConfigure) banner.style.display = 'none';
  });
```

Update `/api/health` in `server.js`:
```javascript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    dodoConfigured: !!(process.env.DODO_PAYMENTS_API_KEY &&
      process.env.DODO_PAYMENTS_API_KEY !== 'your_key_here'),
    solanaConfigured: !!(process.env.SOLANA_PRIVATE_KEY &&
      process.env.SOLANA_PRIVATE_KEY !== 'your_base58_private_key_here'),
    network: 'devnet',
  });
});
```

---

## Part 5 â€” Flow Visualization Widget

> **One widget that tells the entire DodoArc story.** This is what judges screenshot for their notes.

Add a new `flow` view to `views` in `dashboard.js`:

```javascript
flow: async () => {
  const metrics = await API.metrics();
  const { receipts = [] } = await API.settlement();
  const lastSettlement = receipts[0];

  return `
    <div class="dash-page-title">DodoArc Flow</div>
    <div class="dash-page-sub" style="margin-bottom:1.5rem;">
      The complete billing OS â€” from UPI payment to Solana settlement.
    </div>

    <div class="dash-widget" style="background:var(--white);">
      <!-- Flow diagram -->
      <div style="display:flex;align-items:stretch;gap:0;padding:1.5rem 0;overflow-x:auto;">

        ${flowNode('ðŸ“±', 'User Pays', 'UPI Â· PhonePe Â· Card', 'var(--cream)', `${metrics.mrrFormatted}/mo`)}
        ${flowArrow('Dodo Checkout')}
        ${flowNode('ðŸª', 'Webhook', 'Dodo â†’ DodoArc', 'var(--olive-mist)', `${metrics.totalSubscribers} events`)}
        ${flowArrow('Activation')}
        ${flowNode('ðŸŽ›ï¸', 'Credits', 'Allocated per plan', 'var(--lavender-pale)', `${metrics.totalCreditsGranted.toLocaleString()} total`)}
        ${flowArrow('Consumed')}
        ${flowNode('ðŸ¤–', 'Agent Runs', 'Trading Â· Research', 'var(--cream)', `${metrics.completedAgentRuns} runs`)}
        ${flowArrow('x402 payment')}
        ${flowNode('â—Ž', 'USDC Settled', 'Solana devnet', 'var(--olive-mist)', `$${metrics.totalUsdcSettled.toFixed(4)}`)}

      </div>

      <!-- Live last settlement -->
      ${lastSettlement ? `
        <div style="background:var(--cream);border-radius:var(--r-md);padding:0.75rem 1rem;margin-top:0.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <span style="font-size:0.72rem;color:var(--ink-soft);">Last settlement</span>
          <a href="${lastSettlement.explorer}" target="_blank"
             style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--lavender-dark);">
            ${lastSettlement.signature?.slice(0, 16)}â€¦ â†—
          </a>
          <span style="font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--olive-dark);font-weight:600;">
            ${lastSettlement.amountUsdc?.toFixed(4)} USDC
          </span>
          <span style="font-size:0.65rem;color:var(--ink-soft);">
            ${new Date(lastSettlement.timestamp).toLocaleString('en-IN')}
          </span>
        </div>` : `
        <div style="font-size:0.75rem;color:var(--ink-soft);text-align:center;padding:1rem;">
          No settlements yet â€” <button onclick="runFullDemo()" style="background:none;border:none;color:var(--olive);font-weight:600;cursor:pointer;font-size:0.75rem;">run the demo flow</button> to see the complete DodoArc flow.
        </div>`}
    </div>
  `;
},
```

Add helper functions:
```javascript
function flowNode(icon, title, sub, bg, stat) {
  return `
    <div style="
      display:flex;flex-direction:column;align-items:center;
      background:${bg};border-radius:var(--r-md);
      padding:1rem 1.25rem;min-width:110px;flex:1;
      border:1px solid var(--cream-dark);text-align:center;
    ">
      <div style="font-size:1.4rem;margin-bottom:6px;">${icon}</div>
      <div style="font-size:0.78rem;font-weight:600;color:var(--ink);margin-bottom:2px;">${title}</div>
      <div style="font-size:0.65rem;color:var(--ink-soft);margin-bottom:8px;">${sub}</div>
      <div style="font-family:'DM Mono',monospace;font-size:0.7rem;color:var(--olive-dark);font-weight:500;">${stat}</div>
    </div>`;
}

function flowArrow(label) {
  return `
    <div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:0 0.5rem;min-width:60px;
    ">
      <div style="font-size:0.6rem;color:var(--ink-soft);margin-bottom:4px;white-space:nowrap;">${label}</div>
      <div style="font-size:1.1rem;color:var(--olive);">â†’</div>
    </div>`;
}
```

**Add "Flow" to sidebar in `dashboard.html`:**
```html
<div class="sidebar-item" data-view="flow">âŸ¶ Flow</div>
```

---

## Part 6 â€” New Tests for Milestone 4

Create `tests/dashboard.test.js`:

```javascript
// tests/dashboard.test.js

const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

describe('Dashboard Metrics â€” Milestone 4', () => {

  beforeAll(() => {
    // Seed demo data
    const user = db.getOrCreateUser('metrics_test@dodoarc.xyz', 'Metrics Test');
    const sub = db.getSubscriptionByUser(user.id);
    if (!sub) {
      db.createSubscription({
        userId: user.id, planId: 'plan_pro',
        status: 'active', credits_total: 1000, credits_used: 250,
      });
    }
  });

  test('GET /api/dashboard/metrics returns all required fields', async () => {
    const res = await request(app).get('/api/dashboard/metrics');
    expect(res.status).toBe(200);
    expect(typeof res.body.mrr).toBe('number');
    expect(typeof res.body.mrrFormatted).toBe('string');
    expect(typeof res.body.activeSubscribers).toBe('number');
    expect(typeof res.body.totalCreditsUsed).toBe('number');
    expect(typeof res.body.totalUsdcSettled).toBe('number');
    expect(Array.isArray(res.body.monthlyRevenue)).toBe(true);
    expect(res.body.monthlyRevenue).toHaveLength(6);
    expect(res.body.timestamp).toBeDefined();
  });

  test('monthlyRevenue has correct shape', async () => {
    const { body } = await request(app).get('/api/dashboard/metrics');
    const month = body.monthlyRevenue[0];
    expect(month).toHaveProperty('month');
    expect(month).toHaveProperty('inr');
    expect(month).toHaveProperty('usdc');
  });

  test('GET /api/health returns dodoConfigured and solanaConfigured flags', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(typeof res.body.dodoConfigured).toBe('boolean');
    expect(typeof res.body.solanaConfigured).toBe('boolean');
    expect(res.body.network).toBe('devnet');
  });

  test('GET /api/demo/user creates demo user with active subscription', async () => {
    const res = await request(app).get('/api/demo/user');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('demo@dodoarc.xyz');
    expect(res.body.sub.status).toBe('active');
    expect(res.body.sub.credits_total).toBeGreaterThan(0);
  });

  test('POST /api/demo/simulate-payment adds credits to demo user', async () => {
    const { body: before } = await request(app).get('/api/demo/user');
    await request(app).post('/api/demo/simulate-payment');
    const { body: after } = await request(app).get('/api/demo/user');
    expect(after.sub.credits_total).toBeGreaterThan(before.sub.credits_total);
  });

  test('Metrics totalCreditsUsed increases after agent run', async () => {
    const { body: before } = await request(app).get('/api/dashboard/metrics');
    const { body: demoUser } = await request(app).get('/api/demo/user');
    await request(app).post('/api/agent/run').send({ userId: demoUser.user.id });
    const { body: after } = await request(app).get('/api/dashboard/metrics');
    expect(after.totalCreditsUsed).toBeGreaterThan(before.totalCreditsUsed);
  });
});
```

---

## Milestone 4 Completion Checklist

### Real Data (No Mocks)
- [ ] `GET /api/dashboard/metrics` returns live aggregated data from SQLite
- [ ] Revenue chart bars reflect real subscription events (not hardcoded heights)
- [ ] Metric cards show real numbers (MRR, subscribers, credits, USDC)
- [ ] `calcRevenue()` and `calcSettled()` removed â€” replaced by metrics API
- [ ] Settlement widget on overview fetches live from `/api/solana/settlement-log`
- [ ] Credit usage bars reflect real `credits_used` / `credits_total` per subscription

### Real-Time Updates
- [ ] WebSocket server running on same port as HTTP
- [ ] Dashboard "â— LIVE" indicator connected to WebSocket
- [ ] New payment â†’ WebSocket broadcast â†’ dashboard auto-refreshes
- [ ] Agent run complete â†’ WebSocket broadcast â†’ toast notification appears
- [ ] WebSocket reconnects automatically after disconnect

### Demo Flow
- [ ] `GET /api/demo/user` returns or creates demo user with active subscription
- [ ] `POST /api/demo/simulate-payment` fires mock payment event + WebSocket broadcast
- [ ] "â–¶ Run full demo flow" button does: payment sim â†’ agent run â†’ dashboard refresh
- [ ] Demo banner hidden when real `DODO_PAYMENTS_API_KEY` is configured
- [ ] `runDemoAgent()` uses demo user ID (not hardcoded string)

### Polish
- [ ] Skeleton loader shows while view is loading (not plain "Loadingâ€¦")
- [ ] Error state with retry button shown when API call fails
- [ ] Empty state messages in all tables/widgets when data is 0
- [ ] Toast notifications appear for live events (bottom center, auto-dismiss 3s)
- [ ] Flow view shows complete DodoArc story in one screen

### Tests
- [ ] `npm test` passes: minimum 22 tests across 4 suites
- [ ] `/api/dashboard/metrics` returns all required fields
- [ ] `monthlyRevenue` has correct shape (6 months, inr + usdc per month)
- [ ] Demo simulate-payment increases credits
- [ ] Metrics totalCreditsUsed increases after agent run

---

## Quick Reference â€” Files Changed in Milestone 4

| File | Action | What changes |
|------|--------|-------------|
| `src/routes/metrics.js` | **Create** | `GET /api/dashboard/metrics` â€” live aggregated data |
| `src/routes/demo.js` | **Create** | Demo user + simulate payment endpoints |
| `public/dashboard.js` | **Major update** | Fix all mock data, add WebSocket, demo flow, skeleton loader, flow view |
| `public/dashboard.html` | **Update** | Demo banner, skeleton CSS, toast CSS, Flow sidebar item |
| `server.js` | **Update** | WebSocket server, register metrics + demo routes, update health endpoint |
| `tests/dashboard.test.js` | **Create** | 6 new dashboard metric tests |

---

*DodoArc â€” Billing OS for AI Agent Products | Colosseum Frontier 2026 | Milestone 4*
