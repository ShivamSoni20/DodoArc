# DodoArc â€” Milestone 6 Development Plan
## For Claude Code (Agentic Execution)

**Milestone 6 Goal:** Transform DodoArc from a single-developer MVP into a real developer platform â€” multi-developer support, API key auth, MCP server, embeddable SDK, and real Dodo checkout verification
**Current State:** Milestone 5 complete â€” 22 tests, smoke test passing, all 5 gaps verified MISSING/PARTIAL
**Priority Order:** API Keys â†’ Multi-developer â†’ Embed SDK â†’ MCP Server â†’ Real Dodo verify

---

## What Milestone 6 Delivers

| # | Deliverable | Verified Gap | Priority |
|---|-------------|-------------|----------|
| 1 | **API Key middleware** | MISSING â€” no auth on agent/credits routes | P0 â€” security |
| 2 | **Multi-developer DB + routes** | MISSING â€” no developers/apps table | P0 â€” core feature |
| 3 | **Developer registration flow** | MISSING â€” no `/api/developer/register` | P1 |
| 4 | **Embeddable checkout widget** | MISSING â€” no embed script | P1 |
| 5 | **MCP Server** | MISSING â€” no mcp folder, no endpoint | P2 |
| 6 | **Real Dodo checkout verify** | PARTIAL â€” mock fallback, untested live | P2 |

---

## Part 1 â€” API Key Authentication (P0)

> **Fix this first.** Right now anyone who knows a `userId` can run agents and consume credits. This breaks the entire billing model.

### Step 1.1 â€” Add `api_keys` Table to SQLite

Add to `src/services/sqlite.js` inside `db.exec()`:

```sql
CREATE TABLE IF NOT EXISTS developers (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash      TEXT UNIQUE NOT NULL,
  key_prefix    TEXT NOT NULL,
  developer_id  TEXT NOT NULL,
  name          TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at  DATETIME,
  FOREIGN KEY (developer_id) REFERENCES developers(id)
);

CREATE TABLE IF NOT EXISTS developer_apps (
  id            TEXT PRIMARY KEY,
  developer_id  TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  plan_id       TEXT DEFAULT 'plan_pro',
  credits_per_run INTEGER DEFAULT 10,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (developer_id) REFERENCES developers(id)
);
```

### Step 1.2 â€” Add API Key Functions to `src/services/db.js`

```javascript
// Add to stmts object:
insertDeveloper: sqlite.prepare(`
  INSERT OR IGNORE INTO developers (id, email, name)
  VALUES (@id, @email, @name)
`),
getDeveloperByEmail: sqlite.prepare(`SELECT * FROM developers WHERE email = ?`),
getDeveloperById:    sqlite.prepare(`SELECT * FROM developers WHERE id = ?`),

insertApiKey: sqlite.prepare(`
  INSERT INTO api_keys (key_hash, key_prefix, developer_id, name)
  VALUES (@key_hash, @key_prefix, @developer_id, @name)
`),
getApiKeyByHash: sqlite.prepare(`
  SELECT ak.*, d.email as developer_email, d.name as developer_name
  FROM api_keys ak
  JOIN developers d ON d.id = ak.developer_id
  WHERE ak.key_hash = ?
`),
updateApiKeyLastUsed: sqlite.prepare(`
  UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = ?
`),
getApiKeysByDeveloper: sqlite.prepare(`
  SELECT id, key_prefix, name, created_at, last_used_at
  FROM api_keys WHERE developer_id = ?
`),

insertApp: sqlite.prepare(`
  INSERT INTO developer_apps (id, developer_id, name, description, plan_id, credits_per_run)
  VALUES (@id, @developer_id, @name, @description, @plan_id, @credits_per_run)
`),
getAppsByDeveloper: sqlite.prepare(`SELECT * FROM developer_apps WHERE developer_id = ?`),
getAppById: sqlite.prepare(`SELECT * FROM developer_apps WHERE id = ?`),

// Add to module.exports:
// createDeveloper, getOrCreateDeveloper, generateApiKey, validateApiKey, createApp, getApps
```

Add to `module.exports` in `src/services/db.js`:

```javascript
// Developer management
createDeveloper: (email, name) => {
  const id = `dev_${Date.now()}`;
  stmts.insertDeveloper.run({ id, email: email.toLowerCase(), name: name || '' });
  return stmts.getDeveloperByEmail.get(email.toLowerCase());
},
getDeveloperByEmail: (email) => stmts.getDeveloperByEmail.get(email.toLowerCase()),
getDeveloperById: (id) => stmts.getDeveloperById.get(id),

// API Key management
generateApiKey: (developerId, keyName = 'Default') => {
  const crypto = require('crypto');
  // Format: da_live_XXXXXXXXXXXXXXXXXXXX (da = DodoArc)
  const rawKey = 'da_live_' + crypto.randomBytes(24).toString('base64url');
  const keyPrefix = rawKey.slice(0, 12); // "da_live_XXXX"
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  stmts.insertApiKey.run({ key_hash: keyHash, key_prefix: keyPrefix, developer_id: developerId, name: keyName });
  return { key: rawKey, prefix: keyPrefix }; // rawKey shown ONCE, never stored
},
validateApiKey: (rawKey) => {
  const crypto = require('crypto');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const record = stmts.getApiKeyByHash.get(keyHash);
  if (!record) return null;
  stmts.updateApiKeyLastUsed.run(keyHash);
  return record;
},
getApiKeysByDeveloper: (developerId) => stmts.getApiKeysByDeveloper.all(developerId),

// App management
createApp: (developerId, { name, description, planId = 'plan_pro', creditsPerRun = 10 }) => {
  const id = `app_${Date.now()}`;
  stmts.insertApp.run({ id, developer_id: developerId, name, description: description || '', plan_id: planId, credits_per_run: creditsPerRun });
  return stmts.getAppById.get(id);
},
getAppsByDeveloper: (developerId) => stmts.getAppsByDeveloper.all(developerId),
getAppById: (id) => stmts.getAppById.get(id),
```

### Step 1.3 â€” Create `src/middleware/auth.js`

```javascript
// src/middleware/auth.js
const db = require('../services/db');

/**
 * requireApiKey â€” middleware for developer API routes
 * Reads x-api-key header, validates against DB, attaches developer to req
 *
 * Usage: router.post('/run', requireApiKey, handler)
 */
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key',
      hint: 'Add header: x-api-key: da_live_YOUR_KEY',
      docs: '/api/developer/docs',
    });
  }

  const record = db.validateApiKey(apiKey);
  if (!record) {
    return res.status(401).json({
      error: 'Invalid API key',
      hint: 'Generate a key at /dashboard â†’ API Keys',
    });
  }

  // Attach developer context to request
  req.developer = {
    id: record.developer_id,
    email: record.developer_email,
    name: record.developer_name,
  };

  next();
}

/**
 * optionalApiKey â€” same as requireApiKey but does not block
 * Used for demo routes that work with or without auth
 */
function optionalApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (apiKey) {
    const record = db.validateApiKey(apiKey);
    if (record) {
      req.developer = {
        id: record.developer_id,
        email: record.developer_email,
        name: record.developer_name,
      };
    }
  }
  next();
}

module.exports = { requireApiKey, optionalApiKey };
```

### Step 1.4 â€” Apply Auth to Routes

Update `src/routes/agent.js`:

```javascript
// Add at top:
const { requireApiKey } = require('../middleware/auth');

// Change:
// router.post('/run', async (req, res) => {
// To:
router.post('/run', requireApiKey, async (req, res) => {
  // req.developer is now available
  // userId can come from body OR be derived from developer context
  const { userId, agentName = 'Trading Signal Agent' } = req.body;
  const effectiveUserId = userId || req.developer.id;
  // ... rest of handler unchanged, replace `userId` with `effectiveUserId`
});
```

Update `src/routes/credits.js`:

```javascript
const { requireApiKey } = require('../middleware/auth');

// Protect consume endpoint
router.post('/consume', requireApiKey, (req, res) => {
  // ... existing handler
});

// GET balance â€” optional auth (demo works without key)
const { optionalApiKey } = require('../middleware/auth');
router.get('/:userId', optionalApiKey, (req, res) => {
  // ... existing handler
});
```

---

## Part 2 â€” Developer Registration + App Management Routes (P0)

### Step 2.1 â€” Create `src/routes/developer.js`

```javascript
// src/routes/developer.js

const router = require('express').Router();
const db = require('../services/db');
const { requireApiKey } = require('../middleware/auth');

// POST /api/developer/register
// Body: { email, name }
// Returns: { developer, apiKey } â€” key shown ONCE
router.post('/register', (req, res) => {
  const { email, name } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Check if already registered
  const existing = db.getDeveloperByEmail(email);
  if (existing) {
    return res.status(409).json({
      error: 'Email already registered',
      hint: 'Use POST /api/developer/keys to generate a new API key',
    });
  }

  const developer = db.createDeveloper(email, name);
  const { key, prefix } = db.generateApiKey(developer.id, 'Default Key');
  db.logEvent('developer_registered', { developerId: developer.id, email });

  res.status(201).json({
    success: true,
    developer: { id: developer.id, email: developer.email, name: developer.name },
    apiKey: {
      key,               // shown ONCE â€” developer must save this
      prefix,
      warning: 'Save this key now. It will not be shown again.',
    },
  });
});

// GET /api/developer/me
// Returns current developer profile
router.get('/me', requireApiKey, (req, res) => {
  const developer = db.getDeveloperById(req.developer.id);
  const apps = db.getAppsByDeveloper(req.developer.id);
  const keys = db.getApiKeysByDeveloper(req.developer.id);
  res.json({ developer, apps, keys });
});

// POST /api/developer/apps
// Create a new agent app/product
// Body: { name, description, planId, creditsPerRun }
router.post('/apps', requireApiKey, (req, res) => {
  const { name, description, planId, creditsPerRun } = req.body;
  if (!name) return res.status(400).json({ error: 'App name required' });

  const app = db.createApp(req.developer.id, { name, description, planId, creditsPerRun });
  db.logEvent('app_created', { developerId: req.developer.id, appId: app.id, name });

  res.status(201).json({
    success: true,
    app,
    embed: generateEmbedCode(app),          // ready-to-use embed script
    checkoutUrl: `/checkout/${app.id}`,     // shareable checkout URL
  });
});

// GET /api/developer/apps
router.get('/apps', requireApiKey, (req, res) => {
  const apps = db.getAppsByDeveloper(req.developer.id);
  const enriched = apps.map(app => ({
    ...app,
    embed: generateEmbedCode(app),
    checkoutUrl: `/checkout/${app.id}`,
  }));
  res.json({ apps: enriched });
});

// POST /api/developer/keys
// Generate a new API key
router.post('/keys', requireApiKey, (req, res) => {
  const { name = 'New Key' } = req.body;
  const { key, prefix } = db.generateApiKey(req.developer.id, name);
  res.status(201).json({
    success: true,
    apiKey: { key, prefix, warning: 'Save this key now. It will not be shown again.' },
  });
});

// GET /api/developer/keys
router.get('/keys', requireApiKey, (req, res) => {
  const keys = db.getApiKeysByDeveloper(req.developer.id);
  res.json({ keys });          // prefixes only, never raw keys
});

// GET /api/developer/docs
// Quick API reference
router.get('/docs', (req, res) => {
  res.json({
    name: 'DodoArc Developer API',
    version: '1.0.0',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    authentication: 'x-api-key: da_live_YOUR_KEY',
    endpoints: {
      register:       'POST /api/developer/register',
      profile:        'GET  /api/developer/me',
      createApp:      'POST /api/developer/apps',
      listApps:       'GET  /api/developer/apps',
      generateKey:    'POST /api/developer/keys',
      listKeys:       'GET  /api/developer/keys',
      runAgent:       'POST /api/agent/run',
      checkCredits:   'GET  /api/credits/:userId',
      consumeCredits: 'POST /api/credits/consume',
      settlementLog:  'GET  /api/solana/settlement-log',
    },
    quickStart: [
      '1. POST /api/developer/register â†’ get your API key',
      '2. POST /api/developer/apps â†’ create your agent product',
      '3. Copy the embed code â†’ paste into your website',
      '4. Users pay via Dodo checkout â†’ credits auto-activate',
      '5. POST /api/agent/run with x-api-key â†’ consume credits + settle x402',
    ],
  });
});

// Helper: generate embed code for an app
function generateEmbedCode(app) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  return `<!-- DodoArc Checkout Embed -->
<script src="${baseUrl}/embed/dodoarc.js"></script>
<script>
  DodoArc.checkout({
    appId: '${app.id}',
    planId: '${app.plan_id}',
    onSuccess: function(user) {
      console.log('User subscribed:', user.email);
      // Activate access in your app
    }
  });
</script>`;
}

module.exports = router;
```

**Register in `server.js`:**
```javascript
app.use('/api/developer', require('./src/routes/developer'));
```

---

## Part 3 â€” Embeddable Checkout Widget (P1)

> **This is the "3 lines of code" moment.** A developer copies the embed snippet â†’ pastes it â†’ their users see a DodoArc checkout. This is what makes DodoArc a platform, not just a demo.

### Step 3.1 â€” Create `public/embed/dodoarc.js`

```javascript
// public/embed/dodoarc.js
// Embeddable DodoArc checkout widget
// Loaded by: <script src="https://your-dodoarc.com/embed/dodoarc.js"></script>

(function (window) {
  'use strict';

  const DODOARC_BASE = (function () {
    const scripts = document.querySelectorAll('script[src*="dodoarc.js"]');
    if (scripts.length) {
      const url = new URL(scripts[scripts.length - 1].src);
      return url.origin;
    }
    return 'http://localhost:3000';
  })();

  const DodoArc = {
    /**
     * Open a checkout modal for an app
     * @param {Object} opts
     * @param {string} opts.appId       - your DodoArc app ID
     * @param {string} opts.planId      - plan to subscribe to
     * @param {string} [opts.buttonText] - customize button text
     * @param {string} [opts.email]     - pre-fill email
     * @param {Function} [opts.onSuccess] - callback(user) on payment
     * @param {Function} [opts.onError]   - callback(err) on failure
     */
    checkout: function (opts) {
      if (!opts.appId) {
        console.error('[DodoArc] appId is required');
        return;
      }

      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.id = 'dodoarc-overlay';
      overlay.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        background:rgba(42,40,32,0.6);
        display:flex;align-items:center;justify-content:center;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        animation:dodoarc-fade-in 0.2s ease;
      `;

      const modal = document.createElement('div');
      modal.style.cssText = `
        background:#F7F3EC;border-radius:20px;
        padding:2rem;width:360px;max-width:90vw;
        box-shadow:0 20px 60px rgba(0,0,0,0.3);
        position:relative;
      `;

      modal.innerHTML = `
        <style>
          @keyframes dodoarc-fade-in { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
          #dodoarc-overlay button { cursor:pointer; }
        </style>
        <button onclick="document.getElementById('dodoarc-overlay').remove()" style="
          position:absolute;top:1rem;right:1rem;
          background:none;border:none;font-size:1.2rem;color:#7A7568;
        ">Ã—</button>
        <div style="text-align:center;margin-bottom:1.5rem;">
          <div style="font-size:0.7rem;color:#6B7C5C;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.5rem;">Powered by DodoArc</div>
          <div style="font-size:1.4rem;font-weight:600;color:#2A2820;">Get started</div>
          <div style="font-size:0.85rem;color:#7A7568;margin-top:4px;">Pay with UPI, card, or any method</div>
        </div>
        <div id="dodoarc-form">
          <input id="dodoarc-email" type="email" placeholder="your@email.com"
            value="${opts.email || ''}"
            style="
              width:100%;padding:0.75rem;margin-bottom:0.75rem;
              border:1.5px solid #EDE8DE;border-radius:10px;
              font-size:0.9rem;background:#fff;box-sizing:border-box;
              outline:none;
            "
          />
          <button id="dodoarc-pay-btn" style="
            width:100%;padding:0.8rem;
            background:#4A5840;color:#F7F3EC;
            border:none;border-radius:10px;
            font-size:0.9rem;font-weight:600;
            transition:opacity 0.2s;
          ">${opts.buttonText || 'Continue to payment â†’'}</button>
          <div id="dodoarc-error" style="color:#A32D2D;font-size:0.75rem;margin-top:0.5rem;display:none;"></div>
        </div>
        <div style="text-align:center;margin-top:1rem;font-size:0.65rem;color:#7A7568;">
          ðŸ”’ Secured by Dodo Payments Â· UPI Â· Cards Â· 150+ countries
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Wire pay button
      document.getElementById('dodoarc-pay-btn').addEventListener('click', async function () {
        const email = document.getElementById('dodoarc-email').value;
        const errEl = document.getElementById('dodoarc-error');
        const btn = this;

        if (!email || !email.includes('@')) {
          errEl.textContent = 'Please enter a valid email address';
          errEl.style.display = 'block';
          return;
        }

        btn.textContent = 'Creating checkoutâ€¦';
        btn.disabled = true;
        errEl.style.display = 'none';

        try {
          const res = await fetch(`${DODOARC_BASE}/api/checkout/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planId: opts.planId || 'plan_pro',
              email,
              appId: opts.appId,
            }),
          });
          const data = await res.json();

          if (data.payment_url) {
            // Open Dodo checkout in new tab
            window.open(data.payment_url, '_blank');
            overlay.remove();
            if (opts.onSuccess) opts.onSuccess({ email });
          } else if (data.success && data.type === 'free') {
            overlay.remove();
            if (opts.onSuccess) opts.onSuccess({ email, type: 'free' });
          } else {
            errEl.textContent = data.error || 'Something went wrong';
            errEl.style.display = 'block';
            btn.textContent = opts.buttonText || 'Continue to payment â†’';
            btn.disabled = false;
          }
        } catch (err) {
          errEl.textContent = 'Network error. Please try again.';
          errEl.style.display = 'block';
          btn.textContent = opts.buttonText || 'Continue to payment â†’';
          btn.disabled = false;
          if (opts.onError) opts.onError(err);
        }
      });

      // Close on overlay click
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.remove();
      });
    },

    /**
     * Render a checkout button inline
     * @param {string} selector - CSS selector for container element
     * @param {Object} opts - same as checkout()
     */
    renderButton: function (selector, opts) {
      const container = document.querySelector(selector);
      if (!container) return;
      const btn = document.createElement('button');
      btn.textContent = opts.buttonText || 'Subscribe Now';
      btn.style.cssText = `
        background:#4A5840;color:#F7F3EC;
        border:none;border-radius:100px;
        padding:0.75rem 1.75rem;
        font-size:0.9rem;font-weight:600;
        cursor:pointer;
      `;
      btn.addEventListener('click', () => DodoArc.checkout(opts));
      container.appendChild(btn);
    },
  };

  window.DodoArc = DodoArc;
})(window);
```

### Step 3.2 â€” Public Checkout Page Per App

Add route to `server.js`:

```javascript
// GET /checkout/:appId â€” public shareable checkout page for any developer's app
app.get('/checkout/:appId', (req, res) => {
  const db = require('./src/services/db');
  const app = db.getAppById(req.params.appId);
  if (!app) return res.status(404).send('App not found');

  // Serve a minimal HTML page with the embed widget
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${app.name} â€” Subscribe</title>
  <style>
    body { margin:0; background:#F7F3EC; display:flex; align-items:center; justify-content:center; min-height:100vh; font-family:-apple-system,sans-serif; }
    .card { background:#fff; border-radius:20px; padding:2.5rem; max-width:420px; width:90%; box-shadow:0 8px 40px rgba(0,0,0,0.1); text-align:center; }
    h1 { font-size:1.5rem; color:#2A2820; margin-bottom:0.5rem; }
    p { color:#7A7568; font-size:0.9rem; margin-bottom:2rem; }
    .powered { font-size:0.65rem; color:#B8A9C9; margin-top:1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${app.name}</h1>
    <p>${app.description || 'Subscribe to get access'}</p>
    <div id="checkout-btn"></div>
    <div class="powered">Powered by DodoArc Â· Secured by Dodo Payments</div>
  </div>
  <script src="/embed/dodoarc.js"></script>
  <script>
    DodoArc.renderButton('#checkout-btn', {
      appId: '${app.id}',
      planId: '${app.plan_id}',
      buttonText: 'Subscribe Now â†’',
      onSuccess: function(user) {
        document.querySelector('.card').innerHTML = '<h1>âœ… Subscribed!</h1><p>Check your email for access details.</p>';
      }
    });
  </script>
</body>
</html>`);
});
```

---

## Part 4 â€” MCP Server (P2)

> **Agent-native integration.** Claude Code and any AI agent can call DodoArc directly to check credits, consume them, and trigger x402 settlement â€” without a human in the loop.

### Step 4.1 â€” Install MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

### Step 4.2 â€” Create `src/mcp/server.js`

```javascript
// src/mcp/server.js
// DodoArc MCP Server â€” lets AI agents interact with billing natively

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const db = require('../services/db');
const { runTradingAgent } = require('../services/agent');

const server = new McpServer({
  name: 'dodoarc',
  version: '1.0.0',
  description: 'DodoArc billing OS â€” check credits, consume credits, run agents, get settlement receipts',
});

// Tool 1: check_credits
server.tool(
  'check_credits',
  'Check remaining billing credits for a user',
  { userId: z.string().describe('The user ID to check credits for') },
  async ({ userId }) => {
    const remaining = db.getRemainingCredits(userId);
    const sub = db.getSubscriptionByUser(userId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          userId,
          credits_remaining: remaining,
          credits_total: sub?.credits_total || 0,
          credits_used: sub?.credits_used || 0,
          status: sub?.status || 'no_subscription',
          plan: sub?.plan_id || null,
        }),
      }],
    };
  }
);

// Tool 2: consume_credits
server.tool(
  'consume_credits',
  'Deduct credits from a user account (call before running any paid agent action)',
  {
    userId:    z.string().describe('User ID to deduct credits from'),
    amount:    z.number().min(1).describe('Number of credits to consume'),
    agentName: z.string().optional().describe('Name of the agent consuming credits'),
    action:    z.string().optional().describe('Description of the action being performed'),
  },
  async ({ userId, amount, agentName, action }) => {
    const result = db.deductCredits(userId, amount);
    if (!result.success) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: false, error: result.error, userId, amount }),
        }],
        isError: true,
      };
    }
    db.logEvent('credits_consumed_mcp', { userId, amount, agentName, action });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          consumed: amount,
          remaining: result.remaining,
          userId,
        }),
      }],
    };
  }
);

// Tool 3: run_agent
server.tool(
  'run_agent',
  'Run the DodoArc demo trading agent â€” consumes 10 credits and settles x402 USDC on Solana',
  {
    userId:    z.string().describe('User ID (must have active subscription with credits)'),
    agentName: z.string().optional().describe('Agent name for logging'),
  },
  async ({ userId, agentName = 'MCP Agent' }) => {
    const remaining = db.getRemainingCredits(userId);
    if (remaining < 10) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: false, error: 'Insufficient credits', remaining }),
        }],
        isError: true,
      };
    }

    const { v4: uuidv4 } = require('uuid');
    const runId = `mcp_run_${uuidv4().slice(0, 8)}`;
    db.deductCredits(userId, 10);
    db.logAgentRun({ run_id: runId, user_id: userId, agent_name: agentName, credits_used: 10, status: 'running' });

    const result = await runTradingAgent({ runId, userId });

    result.receipts.forEach(r => {
      db.logSettlement({
        agent_run_id: runId, tool_name: r.tool,
        amount_usdc: r.amount, to_wallet: r.to,
        tx_signature: r.signature, explorer_url: r.explorer, mock: r.mock || false,
      });
    });

    db.completeAgentRun(runId, 'completed', result);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          runId,
          signal: result.signal,
          confidence: result.confidence,
          totalUsdcSettled: result.totalUsdcSettled,
          receipts: result.receipts.map(r => ({
            tool: r.tool, amount: r.amount,
            signature: r.signature, explorer: r.explorer,
          })),
          creditsRemaining: remaining - 10,
        }),
      }],
    };
  }
);

// Tool 4: get_settlement_log
server.tool(
  'get_settlement_log',
  'Get recent x402 USDC settlement receipts from Solana devnet',
  { limit: z.number().min(1).max(50).optional().describe('Number of receipts to return (default 10)') },
  async ({ limit = 10 }) => {
    const receipts = db.getRecentSettlements().slice(0, limit);
    const total = receipts.reduce((s, r) => s + (r.amount_usdc || 0), 0);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          receipts: receipts.map(r => ({
            tool: r.tool_name, amountUsdc: r.amount_usdc,
            signature: r.tx_signature, explorer: r.explorer_url,
            mock: !!r.mock, timestamp: r.created_at,
          })),
          totalSettled: total,
          network: 'devnet',
          count: receipts.length,
        }),
      }],
    };
  }
);

// Tool 5: get_dashboard_metrics
server.tool(
  'get_dashboard_metrics',
  'Get live DodoArc dashboard metrics â€” MRR, subscribers, credits, USDC settled',
  {},
  async () => {
    const subs = db.getAllSubscriptions();
    const settlements = db.getRecentSettlements();
    const runs = db.getRecentRuns();
    const active = subs.filter(s => s.status === 'active' && s.plan?.price > 0).length;
    const mrr = subs.filter(s => s.status === 'active').reduce((s, x) => s + (x.plan?.price || 0), 0);
    const totalUsdc = settlements.reduce((s, r) => s + (r.amount_usdc || 0), 0);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          mrr, activeSubscribers: active,
          totalSubscribers: subs.length,
          totalCreditsUsed: subs.reduce((s, x) => s + (x.credits_used || 0), 0),
          totalUsdcSettled: parseFloat(totalUsdc.toFixed(6)),
          completedAgentRuns: runs.filter(r => r.status === 'completed').length,
          network: 'devnet', timestamp: new Date().toISOString(),
        }),
      }],
    };
  }
);

// Start MCP server (stdio transport for Claude Code / MCP clients)
async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[DodoArc MCP] Server started on stdio');
}

module.exports = { server, startMcpServer };
```

### Step 4.3 â€” MCP Entry Point

Create `mcp.js` in project root:

```javascript
// mcp.js â€” MCP server entry point
// Run: node mcp.js
// Or register in Claude Code as MCP server

const { startMcpServer } = require('./src/mcp/server');
startMcpServer().catch(console.error);
```

### Step 4.4 â€” Add `/.well-known/mcp` Discovery Endpoint

Add to `server.js`:

```javascript
// MCP server discovery endpoint
app.get('/.well-known/mcp', (req, res) => {
  res.json({
    name: 'DodoArc',
    description: 'Billing OS for AI agent products â€” credits, x402 settlement, Solana devnet',
    version: '1.0.0',
    mcpServer: {
      command: 'node',
      args: ['mcp.js'],
      transport: 'stdio',
    },
    tools: [
      'check_credits',
      'consume_credits',
      'run_agent',
      'get_settlement_log',
      'get_dashboard_metrics',
    ],
    docs: '/api/developer/docs',
  });
});
```

### Step 4.5 â€” Add MCP Config to `package.json`

```json
{
  "scripts": {
    "mcp": "node mcp.js"
  },
  "mcp": {
    "name": "dodoarc",
    "command": "node",
    "args": ["mcp.js"]
  }
}
```

---

## Part 5 â€” Real Dodo Checkout Verification (P2)

> Make the PARTIAL â†’ COMPLETE. Real INR checkout must work when API key is set.

### Step 5.1 â€” Update `src/routes/checkout.js`

Add `appId` support so developer apps can use checkout:

```javascript
// In POST /api/checkout/create handler, add appId support:
const { planId, email, name, appId } = req.body;

// If appId provided, get plan from the app's config
let effectivePlan = plan;
if (appId) {
  const app = db.getAppById(appId);
  if (app) effectivePlan = db.getPlanById(app.plan_id) || plan;
}
```

### Step 5.2 â€” Create Dodo Verification Script

Create `scripts/verify-dodo-checkout.js`:

```javascript
// scripts/verify-dodo-checkout.js
// Run: node scripts/verify-dodo-checkout.js
// Verifies real Dodo API key works and creates a real checkout session

require('dotenv').config();
const config = require('./src/config');

async function verifyDodo() {
  console.log('\nâ”€â”€ Dodo Payments Checkout Verification â”€â”€\n');

  if (!config.DODO_PAYMENTS_API_KEY || config.DODO_PAYMENTS_API_KEY === 'your_key_here') {
    console.log('âš ï¸  DODO_PAYMENTS_API_KEY not set â€” skipping live verification');
    console.log('   Get your key at: https://app.dodopayments.com â†’ Settings â†’ API Keys');
    return;
  }

  console.log('API Key:', config.DODO_PAYMENTS_API_KEY.slice(0, 12) + 'â€¦');
  console.log('Mode:', config.DODO_MODE || 'sandbox');
  console.log('Product ID:', config.DODO_PRO_PRODUCT_ID || 'NOT SET');

  if (!config.DODO_PRO_PRODUCT_ID) {
    console.log('\nâš ï¸  DODO_PRO_PRODUCT_ID not set');
    console.log('   Run: node scripts/setup-dodo-products.js');
    return;
  }

  // Try creating a real checkout session
  try {
    const dodo = require('./src/services/dodo');
    const session = await dodo.createPaymentLink({
      planId: 'plan_pro',
      customerEmail: 'verify@dodoarc.xyz',
      customerName: 'Verify Test',
      dodoProductId: config.DODO_PRO_PRODUCT_ID,
      metadata: { planId: 'plan_pro', email: 'verify@dodoarc.xyz', test: true },
    });

    console.log('\nâœ… Real Dodo checkout session created');
    console.log('   Payment URL:', session.payment_link?.slice(0, 60) + 'â€¦');
    console.log('   Session ID:', session.id || 'N/A');
    console.log('\n   Open this URL in browser to test real UPI checkout:');
    console.log('  ', session.payment_link);
  } catch (err) {
    console.log('\nâŒ Dodo checkout failed:', err.message);
    console.log('   Check: API key is correct, product ID exists, sandbox mode matches key type');
  }
}

verifyDodo().catch(console.error);
```

**Add to `package.json` scripts:**
```json
"verify-dodo": "node scripts/verify-dodo-checkout.js"
```

---

## Part 6 â€” Dashboard: Developer Portal View

Add a "Developer" view to `public/dashboard.js` â€” shows API keys, apps, and embed code:

```javascript
// Add to views object in dashboard.js:

developer: async () => {
  return `
    <div class="dash-page-title">Developer Portal</div>
    <div class="dash-page-sub" style="margin-bottom:1.5rem;">
      Register, create apps, get API keys, and copy embed code.
    </div>

    <!-- Register Panel -->
    <div class="dash-widget" style="margin-bottom:1rem;">
      <div class="widget-title">Register as Developer</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:1;">
          <label style="font-size:0.7rem;color:var(--ink-soft);display:block;margin-bottom:4px;">Email</label>
          <input id="dev-email" type="email" placeholder="you@example.com" style="
            width:100%;padding:0.6rem 0.8rem;border:1px solid var(--cream-dark);
            border-radius:var(--r-sm);font-size:0.82rem;background:var(--white);
            box-sizing:border-box;
          "/>
        </div>
        <div style="flex:1;">
          <label style="font-size:0.7rem;color:var(--ink-soft);display:block;margin-bottom:4px;">Name</label>
          <input id="dev-name" type="text" placeholder="Your name" style="
            width:100%;padding:0.6rem 0.8rem;border:1px solid var(--cream-dark);
            border-radius:var(--r-sm);font-size:0.82rem;background:var(--white);
            box-sizing:border-box;
          "/>
        </div>
        <button onclick="registerDeveloper()" style="
          background:var(--olive);color:var(--white);
          border:none;border-radius:var(--r-sm);
          padding:0.65rem 1.25rem;font-size:0.82rem;font-weight:600;cursor:pointer;
          white-space:nowrap;
        ">Register â†’</button>
      </div>
      <div id="dev-register-output" style="margin-top:10px;"></div>
    </div>

    <!-- API Key display area -->
    <div id="dev-key-display" style="display:none;" class="dash-widget" style="margin-bottom:1rem;">
      <div class="widget-title">Your API Key <span style="color:#A32D2D;font-size:0.65rem;">â€” Save this now, it will not be shown again</span></div>
      <div id="dev-key-value" style="font-family:'DM Mono',monospace;font-size:0.8rem;background:var(--cream);padding:0.75rem;border-radius:var(--r-sm);word-break:break-all;color:var(--ink);"></div>
      <button onclick="copyApiKey()" style="margin-top:8px;background:var(--ink);color:var(--cream);border:none;border-radius:var(--r-sm);padding:0.4rem 0.8rem;font-size:0.75rem;cursor:pointer;">Copy Key</button>
    </div>

    <!-- Create App -->
    <div class="dash-widget" style="margin-bottom:1rem;">
      <div class="widget-title">Create Agent App</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:2;">
          <label style="font-size:0.7rem;color:var(--ink-soft);display:block;margin-bottom:4px;">App Name</label>
          <input id="app-name" type="text" placeholder="My Trading Agent" style="
            width:100%;padding:0.6rem 0.8rem;border:1px solid var(--cream-dark);
            border-radius:var(--r-sm);font-size:0.82rem;background:var(--white);box-sizing:border-box;
          "/>
        </div>
        <div style="flex:3;">
          <label style="font-size:0.7rem;color:var(--ink-soft);display:block;margin-bottom:4px;">Description</label>
          <input id="app-desc" type="text" placeholder="AI trading signals for Solana" style="
            width:100%;padding:0.6rem 0.8rem;border:1px solid var(--cream-dark);
            border-radius:var(--r-sm);font-size:0.82rem;background:var(--white);box-sizing:border-box;
          "/>
        </div>
        <button onclick="createApp()" style="
          background:var(--olive);color:var(--white);
          border:none;border-radius:var(--r-sm);
          padding:0.65rem 1.25rem;font-size:0.82rem;font-weight:600;cursor:pointer;
          white-space:nowrap;
        ">Create App</button>
      </div>
      <div id="app-create-output" style="margin-top:10px;"></div>
    </div>

    <!-- Embed Code Display -->
    <div id="embed-code-section" style="display:none;" class="dash-widget">
      <div class="widget-title">Embed Code</div>
      <div style="font-size:0.75rem;color:var(--ink-soft);margin-bottom:8px;">Paste this into your website â€” users pay with UPI/card, credits activate automatically.</div>
      <pre id="embed-code" style="background:var(--ink);color:#9FE1CB;padding:1rem;border-radius:var(--r-md);font-size:0.7rem;overflow-x:auto;white-space:pre-wrap;"></pre>
      <button onclick="copyEmbed()" style="margin-top:8px;background:var(--ink);color:var(--cream);border:none;border-radius:var(--r-sm);padding:0.4rem 0.8rem;font-size:0.75rem;cursor:pointer;">Copy Embed Code</button>
    </div>
  `;
},
```

Add to `dashboard.js` (outside views):

```javascript
let currentApiKey = null;
let currentEmbedCode = null;

async function registerDeveloper() {
  const email = document.getElementById('dev-email').value;
  const name = document.getElementById('dev-name').value;
  const output = document.getElementById('dev-register-output');

  if (!email || !email.includes('@')) {
    output.innerHTML = '<div style="color:#A32D2D;font-size:0.78rem;">Valid email required</div>';
    return;
  }

  const res = await fetch('/api/developer/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  const data = await res.json();

  if (data.success) {
    currentApiKey = data.apiKey.key;
    document.getElementById('dev-key-display').style.display = 'block';
    document.getElementById('dev-key-value').textContent = currentApiKey;
    sessionStorage.setItem('dodoarc_api_key', currentApiKey);
    output.innerHTML = `<div style="color:var(--olive);font-size:0.78rem;">âœ… Registered as ${data.developer.email}</div>`;
  } else {
    output.innerHTML = `<div style="color:#A32D2D;font-size:0.78rem;">âŒ ${data.error}</div>`;
  }
}

async function createApp() {
  const name = document.getElementById('app-name').value;
  const desc = document.getElementById('app-desc').value;
  const apiKey = currentApiKey || sessionStorage.getItem('dodoarc_api_key');
  const output = document.getElementById('app-create-output');

  if (!name) { output.innerHTML = '<div style="color:#A32D2D;font-size:0.78rem;">App name required</div>'; return; }
  if (!apiKey) { output.innerHTML = '<div style="color:#A32D2D;font-size:0.78rem;">Register first to get an API key</div>'; return; }

  const res = await fetch('/api/developer/apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ name, description: desc }),
  });
  const data = await res.json();

  if (data.success) {
    currentEmbedCode = data.embed;
    document.getElementById('embed-code-section').style.display = 'block';
    document.getElementById('embed-code').textContent = data.embed;
    output.innerHTML = `<div style="color:var(--olive);font-size:0.78rem;">âœ… App created: ${data.app.name} Â· <a href="${data.checkoutUrl}" target="_blank" style="color:var(--lavender-dark);">Preview checkout â†—</a></div>`;
  } else {
    output.innerHTML = `<div style="color:#A32D2D;font-size:0.78rem;">âŒ ${data.error}</div>`;
  }
}

function copyApiKey() {
  if (currentApiKey) navigator.clipboard.writeText(currentApiKey).then(() => showToast('API key copied'));
}

function copyEmbed() {
  if (currentEmbedCode) navigator.clipboard.writeText(currentEmbedCode).then(() => showToast('Embed code copied'));
}
```

**Add to sidebar in `dashboard.html`:**
```html
<div class="sidebar-item" data-view="developer">âš™ï¸ Developer</div>
```

---

## Milestone 6 Completion Checklist

### API Keys + Auth
- [ ] `api_keys`, `developers`, `developer_apps` tables created in SQLite
- [ ] `db.generateApiKey()` returns `da_live_XXX` format key
- [ ] `db.validateApiKey()` hashes and looks up correctly
- [ ] `src/middleware/auth.js` `requireApiKey` blocks without key (401)
- [ ] `POST /api/agent/run` requires `x-api-key` header
- [ ] `POST /api/credits/consume` requires `x-api-key` header

### Developer Routes
- [ ] `POST /api/developer/register` creates developer + returns API key (shown once)
- [ ] `GET /api/developer/me` returns profile + apps + key prefixes
- [ ] `POST /api/developer/apps` creates app + returns embed code
- [ ] `GET /api/developer/apps` returns app list
- [ ] `GET /api/developer/docs` returns API reference JSON
- [ ] `GET /api/developer/keys` returns prefixes only (never raw keys)

### Embed Widget
- [ ] `public/embed/dodoarc.js` served at `/embed/dodoarc.js`
- [ ] `DodoArc.checkout({ appId, planId })` opens modal with email input
- [ ] `DodoArc.renderButton(selector, opts)` injects button into DOM
- [ ] `GET /checkout/:appId` serves standalone checkout page
- [ ] Modal closes on overlay click and Ã— button

### MCP Server
- [ ] `@modelcontextprotocol/sdk` installed
- [ ] `src/mcp/server.js` defines 5 tools
- [ ] `mcp.js` entry point runs without error (`node mcp.js`)
- [ ] `GET /.well-known/mcp` returns discovery JSON
- [ ] `npm run mcp` starts MCP server

### Real Dodo Verify
- [ ] `npm run verify-dodo` runs without crash
- [ ] When `DODO_PAYMENTS_API_KEY` is set: real checkout URL returned
- [ ] `appId` parameter in checkout route works correctly

### Dashboard
- [ ] "Developer" view accessible via sidebar
- [ ] Register form â†’ API key displayed in masked field
- [ ] Create app form â†’ embed code displayed + copyable
- [ ] Checkout preview link works for created app

---

## Quick Reference â€” New Files in Milestone 6

| File | Action | What it does |
|------|--------|-------------|
| `src/middleware/auth.js` | **Create** | API key validation middleware |
| `src/routes/developer.js` | **Create** | Register, apps, keys, docs endpoints |
| `src/mcp/server.js` | **Create** | MCP server with 5 tools |
| `mcp.js` | **Create** | MCP entry point |
| `public/embed/dodoarc.js` | **Create** | Embeddable checkout widget |
| `scripts/verify-dodo-checkout.js` | **Create** | Real Dodo checkout verification |
| `src/services/db.js` | **Update** | Add developer, API key, app functions |
| `src/services/sqlite.js` | **Update** | Add 3 new tables |
| `src/routes/agent.js` | **Update** | Apply `requireApiKey` middleware |
| `src/routes/credits.js` | **Update** | Apply `requireApiKey` on consume |
| `server.js` | **Update** | Register developer routes, checkout page, MCP discovery |
| `public/dashboard.js` | **Update** | Add developer view + register/createApp functions |
| `public/dashboard.html` | **Update** | Add Developer sidebar item |
| `package.json` | **Update** | Add `mcp` and `verify-dodo` scripts |

---

*DodoArc â€” Billing OS for AI Agent Products | Colosseum Frontier 2026 | Milestone 6*
