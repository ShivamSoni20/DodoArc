# DodoArc â€” Milestone 3 Development Plan
## For Claude Code (Agentic Execution)

**Milestone 3 Goal:** Ship one working agent flow that consumes paid credits + shows real Solana-linked x402 USDC settlement + Phantom wallet connect
**Current State:** Milestone 2 complete â€” 8 tests passing, SQLite persistent, idempotent webhooks, split pages, settlement-log shape ready on devnet
**Deadline:** May 11, 2026 (Colosseum Frontier)

---

## What Milestone 3 Delivers

| # | Deliverable | Why It Matters |
|---|-------------|----------------|
| 1 | **Phantom wallet connect** | Developer links their Solana wallet â†’ receives USDC settlement |
| 2 | **Working demo agent** | A real agent that consumes credits per run (trading signal agent) |
| 3 | **x402 USDC micropayment** | Agent calls a paid tool â†’ USDC transfers on Solana devnet |
| 4 | **Settlement receipts on-chain** | Every x402 call leaves a real devnet transaction signature |
| 5 | **Dashboard wired to real data** | Settlement log shows live devnet tx signatures, not mock data |
| 6 | **`/agent/run` endpoint** | Public API â€” any agent calls this to consume credits + trigger x402 |

---

## Architecture After Milestone 3

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        DodoArc â€” M3 State                           â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Landing /   â”‚  Dashboard    â”‚  Agent API      â”‚  Solana Layer      â”‚
â”‚  index.html  â”‚  dashboard.htmlâ”‚  /agent/run    â”‚  devnet            â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Dodo checkoutâ”‚ Live metrics  â”‚ Credit check    â”‚ Phantom connect    â”‚
â”‚ Plan buttons â”‚ Webhook log   â”‚ Agent execution â”‚ USDC token acct    â”‚
â”‚ landing.js   â”‚ Settlement logâ”‚ x402 payment    â”‚ x402 transfer      â”‚
â”‚              â”‚ Wallet sectionâ”‚ Receipt store   â”‚ Devnet tx sig      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

Flow:
User (UPI) â†’ Dodo â†’ Credits â†’ /agent/run â†’ Credit deduct
                                         â†’ Demo agent executes
                                         â†’ x402 â†’ USDC devnet transfer
                                         â†’ Receipt saved to SQLite
                                         â†’ Dashboard shows tx sig
```

---

## Part 1 â€” Phantom Wallet Connect

> **Why:** Judges want to see a Solana wallet receiving real settlement. Phantom Connect is the #1 signal judges look for in Solana-native products. It also unlocks the x402 payment path.

### Step 1.1 â€” Add Wallet Connect to Dashboard

In `public/dashboard.html`, add a wallet section in the top bar (right side, next to the back link):

```html
<!-- In db-topbar, replace the right side with: -->
<div style="display:flex;align-items:center;gap:12px;">
  <span id="live-indicator" style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--olive);">â— LIVE</span>

  <!-- Wallet Connect Button -->
  <div id="wallet-section">
    <button id="wallet-connect-btn" onclick="connectWallet()" style="
      display:flex; align-items:center; gap:6px;
      background:var(--ink); color:var(--cream);
      border:none; border-radius:100px;
      padding:0.45rem 1rem;
      font-family:'Instrument Sans',sans-serif;
      font-size:0.75rem; font-weight:600;
      cursor:pointer; transition:background 0.2s;
    ">
      <span>ðŸ‘»</span> Connect Phantom
    </button>
    <div id="wallet-connected" style="display:none; align-items:center; gap:8px;">
      <span style="width:8px;height:8px;background:var(--olive);border-radius:50%;display:inline-block;"></span>
      <span id="wallet-address" style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--ink-mid);"></span>
      <button onclick="disconnectWallet()" style="
        background:none; border:1px solid var(--cream-dark);
        border-radius:100px; padding:2px 8px;
        font-size:0.65rem; color:var(--ink-soft); cursor:pointer;
      ">Disconnect</button>
    </div>
  </div>

  <a href="/" class="db-back-link">â† Back to site</a>
</div>
```

### Step 1.2 â€” Add Wallet Connect Logic to `public/dashboard.js`

Add these functions at the top of `dashboard.js` (before the `API` object):

```javascript
// â”€â”€ Phantom Wallet Connect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let connectedWallet = null;

async function connectWallet() {
  try {
    // Check if Phantom is installed
    const provider = window.phantom?.solana;
    if (!provider?.isPhantom) {
      const install = confirm(
        'Phantom wallet not found.\n\nClick OK to install Phantom, or Cancel to use demo mode.'
      );
      if (install) window.open('https://phantom.app/', '_blank');
      // Fall back to demo mode
      useDemoWallet();
      return;
    }

    // Request connection
    const response = await provider.connect();
    const pubkey = response.publicKey.toString();
    setWalletConnected(pubkey);

    // Save to backend
    await fetch('/api/solana/connect-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: pubkey }),
    });

    console.log('[Wallet] Connected:', pubkey);
  } catch (err) {
    console.warn('[Wallet] Connection failed:', err.message);
    // Offer demo mode if user cancels
    if (err.code === 4001) {
      console.log('[Wallet] User rejected â€” demo mode');
    }
  }
}

function useDemoWallet() {
  // Demo wallet for hackathon demo without real Phantom
  const demoKey = 'DodoArc1111111111111111111111111111111111111';
  setWalletConnected(demoKey, true);
  fetch('/api/solana/connect-wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: demoKey, demo: true }),
  });
}

function setWalletConnected(pubkey, isDemo = false) {
  connectedWallet = pubkey;
  const short = pubkey.slice(0, 4) + '...' + pubkey.slice(-4);
  document.getElementById('wallet-connect-btn').style.display = 'none';
  const connectedEl = document.getElementById('wallet-connected');
  connectedEl.style.display = 'flex';
  document.getElementById('wallet-address').textContent =
    (isDemo ? '(demo) ' : '') + short;

  // Store in sessionStorage so it survives view switches
  sessionStorage.setItem('dodoarc_wallet', pubkey);
  sessionStorage.setItem('dodoarc_wallet_demo', isDemo ? '1' : '0');
}

function disconnectWallet() {
  connectedWallet = null;
  sessionStorage.removeItem('dodoarc_wallet');
  sessionStorage.removeItem('dodoarc_wallet_demo');
  document.getElementById('wallet-connect-btn').style.display = 'flex';
  document.getElementById('wallet-connected').style.display = 'none';
  window.phantom?.solana?.disconnect();
}

// Restore wallet state on page load
function restoreWalletState() {
  const saved = sessionStorage.getItem('dodoarc_wallet');
  const isDemo = sessionStorage.getItem('dodoarc_wallet_demo') === '1';
  if (saved) setWalletConnected(saved, isDemo);
}

// Auto-connect if Phantom was previously connected
async function tryAutoConnect() {
  try {
    const provider = window.phantom?.solana;
    if (provider?.isPhantom) {
      // Eager connect (won't show popup if previously approved)
      const response = await provider.connect({ onlyIfTrusted: true });
      setWalletConnected(response.publicKey.toString());
    }
  } catch {
    // Not previously connected â€” that's fine
  }
}

// Call on init
restoreWalletState();
tryAutoConnect();
```

### Step 1.3 â€” Add Wallet Connect Backend Route

Add to `src/routes/solana.js`:

```javascript
// POST /api/solana/connect-wallet
// Saves connected wallet address for USDC settlement routing
router.post('/connect-wallet', (req, res) => {
  const { wallet, demo } = req.body;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });

  // Store in config for this session (replace with DB in production)
  process.env.CONNECTED_WALLET = wallet;
  process.env.WALLET_IS_DEMO = demo ? '1' : '0';

  console.log(`[Solana] Wallet connected: ${wallet} ${demo ? '(demo)' : ''}`);
  db.logEvent('wallet_connected', { wallet: wallet.slice(0, 8) + 'â€¦', demo: !!demo });

  res.json({ success: true, wallet, network: 'devnet' });
});

// GET /api/solana/wallet-status
router.get('/wallet-status', (req, res) => {
  const wallet = process.env.CONNECTED_WALLET;
  res.json({
    connected: !!wallet,
    wallet: wallet || null,
    demo: process.env.WALLET_IS_DEMO === '1',
    network: 'devnet',
    explorer: wallet
      ? `https://explorer.solana.com/address/${wallet}?cluster=devnet`
      : null,
  });
});
```

---

## Part 2 â€” Demo Agent (`/agent/run`)

> **The core M3 deliverable.** A real endpoint that: checks credits â†’ runs a demo trading agent â†’ calls a paid tool via x402 â†’ settles USDC on Solana devnet â†’ stores receipt.

### Step 2.1 â€” Install Solana Dependencies

```bash
npm install @solana/web3.js @solana/spl-token bs58
```

### Step 2.2 â€” Update `src/services/solana.js`

Replace the existing devnet-config-only file with real transfer logic:

```javascript
// src/services/solana.js â€” Milestone 3: real devnet USDC transfers

const {
  Connection, PublicKey, Keypair, Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getMint,
} = require('@solana/spl-token');
const bs58 = require('bs58');
const config = require('../config');

// â”€â”€ Connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const connection = new Connection(
  config.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// â”€â”€ USDC on devnet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Official devnet USDC mint
const USDC_MINT_DEVNET = new PublicKey(
  config.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);

// â”€â”€ Payer wallet (DodoArc settlement wallet) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getPayerKeypair() {
  const key = config.SOLANA_PRIVATE_KEY;
  if (!key || key === 'your_base58_private_key_here') {
    // Return a throwaway demo keypair for devnet testing
    return Keypair.generate();
  }
  try {
    return Keypair.fromSecretKey(bs58.decode(key));
  } catch {
    return Keypair.generate();
  }
}

/**
 * x402 USDC micropayment on Solana devnet
 * Transfers `amountUsdc` USDC from DodoArc wallet â†’ tool provider wallet
 *
 * @param {Object} opts
 * @param {string} opts.toWallet      - recipient public key (tool provider)
 * @param {number} opts.amountUsdc    - amount in USDC (e.g. 0.001)
 * @param {string} opts.memo          - what this payment is for
 * @returns {Promise<{signature, explorer, amount, to}>}
 */
async function x402Pay({ toWallet, amountUsdc, memo }) {
  const payer = getPayerKeypair();

  // USDC has 6 decimals
  const mint = await getMint(connection, USDC_MINT_DEVNET);
  const amountRaw = Math.round(amountUsdc * Math.pow(10, mint.decimals));

  // Get or create token accounts
  const fromATA = await getOrCreateAssociatedTokenAccount(
    connection, payer, USDC_MINT_DEVNET, payer.publicKey
  );
  const toPublicKey = new PublicKey(toWallet);
  const toATA = await getOrCreateAssociatedTokenAccount(
    connection, payer, USDC_MINT_DEVNET, toPublicKey
  );

  // Check balance
  if (Number(fromATA.amount) < amountRaw) {
    throw new Error(
      `Insufficient devnet USDC. Have: ${Number(fromATA.amount) / 1e6}, need: ${amountUsdc}. ` +
      `Request airdrop at https://faucet.solana.com`
    );
  }

  // Build transaction
  const tx = new Transaction().add(
    createTransferInstruction(
      fromATA.address,
      toATA.address,
      payer.publicKey,
      amountRaw
    )
  );

  // Send and confirm
  const signature = await sendAndConfirmTransaction(connection, tx, [payer]);

  return {
    signature,
    explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    amount: amountUsdc,
    to: toWallet,
    memo,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Airdrop devnet SOL to a wallet (for gas)
 * Use this during setup/demo to fund the payer wallet
 */
async function airdropSol(walletAddress, solAmount = 1) {
  const pubkey = new PublicKey(walletAddress);
  const sig = await connection.requestAirdrop(pubkey, solAmount * 1e9);
  await connection.confirmTransaction(sig);
  return { signature: sig, amount: solAmount, wallet: walletAddress };
}

/**
 * Get wallet USDC balance on devnet
 */
async function getUsdcBalance(walletAddress) {
  try {
    const pubkey = new PublicKey(walletAddress);
    const ata = await getOrCreateAssociatedTokenAccount(
      connection, getPayerKeypair(), USDC_MINT_DEVNET, pubkey
    );
    return Number(ata.amount) / 1e6;
  } catch {
    return 0;
  }
}

/**
 * Mock x402 payment â€” used when no private key is configured
 * Returns a realistic-looking receipt without touching devnet
 */
function mockX402Pay({ toWallet, amountUsdc, memo }) {
  const fakeSig = bs58.encode(Buffer.from(
    Array.from({ length: 64 }, () => Math.floor(Math.random() * 256))
  ));
  return {
    signature: fakeSig,
    explorer: `https://explorer.solana.com/tx/${fakeSig}?cluster=devnet`,
    amount: amountUsdc,
    to: toWallet,
    memo,
    timestamp: new Date().toISOString(),
    mock: true,
  };
}

module.exports = {
  connection,
  x402Pay,
  mockX402Pay,
  airdropSol,
  getUsdcBalance,
  getPayerKeypair,
  USDC_MINT_DEVNET,
};
```

### Step 2.3 â€” Add SQLite Table for Settlement Receipts

Add to `src/services/sqlite.js` (inside the `db.exec()` call):

```sql
CREATE TABLE IF NOT EXISTS settlement_receipts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_run_id TEXT,
  tool_name    TEXT,
  amount_usdc  REAL,
  to_wallet    TEXT,
  tx_signature TEXT,
  explorer_url TEXT,
  mock         INTEGER DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       TEXT UNIQUE,
  user_id      TEXT,
  agent_name   TEXT,
  credits_used INTEGER,
  status       TEXT DEFAULT 'running',
  result       TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

Add these prepared statements to `src/services/db.js`:

```javascript
// Add to stmts object in db.js:
insertSettlement: sqlite.prepare(`
  INSERT INTO settlement_receipts
    (agent_run_id, tool_name, amount_usdc, to_wallet, tx_signature, explorer_url, mock)
  VALUES (@agent_run_id, @tool_name, @amount_usdc, @to_wallet, @tx_signature, @explorer_url, @mock)
`),
getRecentSettlements: sqlite.prepare(`
  SELECT * FROM settlement_receipts ORDER BY created_at DESC LIMIT 20
`),
insertAgentRun: sqlite.prepare(`
  INSERT OR IGNORE INTO agent_runs (run_id, user_id, agent_name, credits_used, status)
  VALUES (@run_id, @user_id, @agent_name, @credits_used, @status)
`),
completeAgentRun: sqlite.prepare(`
  UPDATE agent_runs SET status = @status, result = @result, completed_at = CURRENT_TIMESTAMP
  WHERE run_id = @run_id
`),
getRecentRuns: sqlite.prepare(`
  SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 20
`),

// Add to module.exports:
// logSettlement: (data) => stmts.insertSettlement.run(data),
// getRecentSettlements: () => stmts.getRecentSettlements.all(),
// logAgentRun: (data) => stmts.insertAgentRun.run(data),
// completeAgentRun: (runId, status, result) => stmts.completeAgentRun.run({ run_id: runId, status, result }),
// getRecentRuns: () => stmts.getRecentRuns.all(),
```

Full additions to `module.exports` in `src/services/db.js`:

```javascript
// Add these to the existing module.exports:

logSettlement: (data) => stmts.insertSettlement.run({
  agent_run_id: data.agent_run_id,
  tool_name:    data.tool_name,
  amount_usdc:  data.amount_usdc,
  to_wallet:    data.to_wallet,
  tx_signature: data.tx_signature,
  explorer_url: data.explorer_url,
  mock:         data.mock ? 1 : 0,
}),

getRecentSettlements: () => stmts.getRecentSettlements.all(),

logAgentRun: (data) => stmts.insertAgentRun.run(data),

completeAgentRun: (runId, status, result) => stmts.completeAgentRun.run({
  run_id: runId,
  status,
  result: JSON.stringify(result),
}),

getRecentRuns: () => stmts.getRecentRuns.all().map(r => ({
  ...r,
  result: r.result ? JSON.parse(r.result) : null,
})),
```

### Step 2.4 â€” Create the Demo Agent Service

```javascript
// src/services/agent.js â€” Demo trading signal agent

const solana = require('./solana');
const config = require('../config');

// Tool providers for x402 payments (devnet wallets)
// Replace with real provider wallets in production
const TOOL_PROVIDERS = {
  'market-data':     config.TOOL_WALLET_MARKET  || 'So11111111111111111111111111111111111111112',
  'sentiment-feed':  config.TOOL_WALLET_SENTIMENT|| 'So11111111111111111111111111111111111111112',
  'signal-engine':   config.TOOL_WALLET_SIGNAL   || 'So11111111111111111111111111111111111111112',
};

const TOOL_COSTS_USDC = {
  'market-data':    0.001,
  'sentiment-feed': 0.0005,
  'signal-engine':  0.002,
};

/**
 * Run the demo trading signal agent.
 * Steps:
 *   1. Fetch market data (x402 pay â†’ tool provider)
 *   2. Analyze sentiment (x402 pay â†’ tool provider)
 *   3. Generate signal (x402 pay â†’ tool provider)
 *   4. Return result + all settlement receipts
 */
async function runTradingAgent({ runId, userId }) {
  const receipts = [];
  const logs = [];
  const useRealSolana = !!config.SOLANA_PRIVATE_KEY &&
    config.SOLANA_PRIVATE_KEY !== 'your_base58_private_key_here';

  const payFn = useRealSolana ? solana.x402Pay : solana.mockX402Pay;

  // Step 1 â€” Market Data Tool
  logs.push('ðŸ“Š Calling market-data tool via x402â€¦');
  const marketReceipt = await payFn({
    toWallet: TOOL_PROVIDERS['market-data'],
    amountUsdc: TOOL_COSTS_USDC['market-data'],
    memo: `DodoArc x402 Â· market-data Â· run:${runId}`,
  });
  receipts.push({ tool: 'market-data', ...marketReceipt });
  logs.push(`âœ… Market data settled: ${marketReceipt.signature.slice(0, 12)}â€¦`);

  // Simulate market data result
  const marketData = {
    SOL_USD: (140 + Math.random() * 20).toFixed(2),
    BTC_USD: (95000 + Math.random() * 5000).toFixed(0),
    volume_24h: '$' + (1.2 + Math.random() * 0.8).toFixed(1) + 'B',
  };

  // Step 2 â€” Sentiment Feed Tool
  logs.push('ðŸ’¬ Calling sentiment-feed tool via x402â€¦');
  const sentimentReceipt = await payFn({
    toWallet: TOOL_PROVIDERS['sentiment-feed'],
    amountUsdc: TOOL_COSTS_USDC['sentiment-feed'],
    memo: `DodoArc x402 Â· sentiment-feed Â· run:${runId}`,
  });
  receipts.push({ tool: 'sentiment-feed', ...sentimentReceipt });
  logs.push(`âœ… Sentiment settled: ${sentimentReceipt.signature.slice(0, 12)}â€¦`);

  const sentiments = ['Bullish', 'Neutral', 'Bearish'];
  const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];

  // Step 3 â€” Signal Engine Tool
  logs.push('âš¡ Calling signal-engine tool via x402â€¦');
  const signalReceipt = await payFn({
    toWallet: TOOL_PROVIDERS['signal-engine'],
    amountUsdc: TOOL_COSTS_USDC['signal-engine'],
    memo: `DodoArc x402 Â· signal-engine Â· run:${runId}`,
  });
  receipts.push({ tool: 'signal-engine', ...signalReceipt });
  logs.push(`âœ… Signal engine settled: ${signalReceipt.signature.slice(0, 12)}â€¦`);

  // Generate final signal
  const signals = ['BUY', 'HOLD', 'SELL'];
  const signal = signals[Math.floor(Math.random() * signals.length)];
  const confidence = (65 + Math.random() * 30).toFixed(0);

  const totalUsdc = receipts.reduce((s, r) => s + r.amount, 0);
  logs.push(`ðŸŽ¯ Signal generated: ${signal} SOL @ ${confidence}% confidence`);
  logs.push(`ðŸ’° Total x402 settled: ${totalUsdc.toFixed(4)} USDC across 3 tools`);

  return {
    signal,
    confidence: Number(confidence),
    sentiment,
    marketData,
    totalUsdcSettled: totalUsdc,
    receipts,
    logs,
    mock: !useRealSolana,
  };
}

module.exports = { runTradingAgent, TOOL_COSTS_USDC };
```

### Step 2.5 â€” Create `/agent/run` Route

Create `src/routes/agent.js`:

```javascript
// src/routes/agent.js

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');
const { runTradingAgent } = require('../services/agent');

// POST /api/agent/run
// Body: { userId, agentName? }
// Headers: x-api-key (optional â€” add auth in M4)
router.post('/run', async (req, res) => {
  const { userId, agentName = 'Trading Signal Agent' } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  // Check credits
  const remaining = db.getRemainingCredits(userId);
  if (remaining < 10) {
    return res.status(402).json({
      error: 'Insufficient credits',
      remaining,
      message: 'Subscribe at /pricing to get more credits',
    });
  }

  const runId = `run_${uuidv4().slice(0, 8)}`;

  // Log run start
  db.logAgentRun({
    run_id: runId,
    user_id: userId,
    agent_name: agentName,
    credits_used: 10,
    status: 'running',
  });

  try {
    // Deduct credits BEFORE running (prevents running with 0 credits)
    const deduct = db.deductCredits(userId, 10);
    if (!deduct.success) {
      return res.status(402).json({ error: deduct.error });
    }

    // Run the agent
    const result = await runTradingAgent({ runId, userId });

    // Store settlement receipts
    result.receipts.forEach(receipt => {
      db.logSettlement({
        agent_run_id: runId,
        tool_name:    receipt.tool,
        amount_usdc:  receipt.amount,
        to_wallet:    receipt.to,
        tx_signature: receipt.signature,
        explorer_url: receipt.explorer,
        mock:         receipt.mock || false,
      });
    });

    // Log event for dashboard feed
    db.logEvent('agent_run_completed', {
      runId,
      userId,
      agentName,
      signal: result.signal,
      creditsUsed: 10,
      usdcSettled: result.totalUsdcSettled,
    });

    // Complete the run
    db.completeAgentRun(runId, 'completed', result);

    res.json({
      success: true,
      runId,
      creditsUsed: 10,
      creditsRemaining: deduct.remaining,
      result,
    });

  } catch (err) {
    console.error('[Agent] Run failed:', err.message);
    db.completeAgentRun(runId, 'failed', { error: err.message });
    db.logEvent('agent_run_failed', { runId, userId, error: err.message });
    res.status(500).json({ error: err.message, runId });
  }
});

// GET /api/agent/runs â€” recent agent runs (for dashboard)
router.get('/runs', (req, res) => {
  res.json({ runs: db.getRecentRuns() });
});

module.exports = router;
```

**Install uuid:**
```bash
npm install uuid
```

**Register in `server.js`:**
```javascript
app.use('/api/agent', require('./src/routes/agent'));
```

### Step 2.6 â€” Update `/api/solana/settlement-log` Route

Update `src/routes/solana.js` to return real DB data:

```javascript
// GET /api/solana/settlement-log â€” real receipts from SQLite
router.get('/settlement-log', (req, res) => {
  const receipts = db.getRecentSettlements();
  const total = receipts.reduce((s, r) => s + (r.amount_usdc || 0), 0);

  res.json({
    receipts: receipts.map(r => ({
      id:          r.id,
      agentRunId:  r.agent_run_id,
      tool:        r.tool_name,
      amountUsdc:  r.amount_usdc,
      toWallet:    r.to_wallet,
      signature:   r.tx_signature,
      explorer:    r.explorer_url,
      mock:        !!r.mock,
      timestamp:   r.created_at,
    })),
    totalSettled: total,
    network: 'devnet',
    count: receipts.length,
  });
});
```

---

## Part 3 â€” Update Dashboard for Agents + Settlement

### Step 3.1 â€” Add "Agents" view to `public/dashboard.js`

Add this to the `views` object:

```javascript
agents: async () => {
  const [{ runs = [] }, { receipts = [], totalSettled = 0 }] = await Promise.all([
    API.agentRuns(),
    API.settlement(),
  ]);

  const wallet = sessionStorage.getItem('dodoarc_wallet');
  const walletConnected = !!wallet;

  return `
    <div class="dash-page-title">Agent Runs</div>
    <div class="dash-page-sub" style="margin-bottom:1.25rem;">
      Each run consumes 10 credits and triggers x402 USDC settlement on Solana devnet.
    </div>

    <!-- Run Agent Panel -->
    <div class="dash-widget" style="margin-bottom:1rem;background:var(--olive-mist);border-color:rgba(107,124,92,0.3);">
      <div class="widget-title">Run Demo Agent</div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;font-size:0.82rem;color:var(--ink-soft);line-height:1.6;">
          Trading Signal Agent â€” fetches market data, analyzes sentiment, generates signal.
          Costs 10 credits per run. Settles 0.0035 USDC via x402 across 3 tool calls.
        </div>
        <button id="run-agent-btn"
          onclick="runDemoAgent()"
          style="
            background:var(--olive);color:var(--white);
            border:none;border-radius:100px;
            padding:0.65rem 1.5rem;
            font-family:'Instrument Sans',sans-serif;
            font-size:0.85rem;font-weight:600;
            cursor:pointer;white-space:nowrap;
          ">
          â–¶ Run Agent (10 credits)
        </button>
      </div>
      <div id="agent-run-output" style="display:none;margin-top:1rem;"></div>
    </div>

    <!-- Settlement Log -->
    <div class="dash-widget" style="margin-bottom:1rem;">
      <div class="widget-title">
        x402 Settlement Log
        <span style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-soft);">
          ${totalSettled.toFixed(4)} USDC total Â· devnet
        </span>
      </div>
      ${receipts.length === 0
        ? '<div style="font-size:0.78rem;color:var(--ink-soft);padding:0.5rem 0;">No settlements yet. Run the demo agent above to trigger x402 USDC payments.</div>'
        : `<table class="sub-table">
            <thead><tr><th>Run ID</th><th>Tool</th><th>Amount</th><th>Tx Signature</th><th>Time</th><th>Type</th></tr></thead>
            <tbody>
              ${receipts.map(r => `<tr>
                <td style="font-family:'DM Mono',monospace;font-size:0.62rem;">${r.agentRunId || 'â€”'}</td>
                <td>${r.tool || 'â€”'}</td>
                <td style="font-family:'DM Mono',monospace;">${r.amountUsdc} USDC</td>
                <td>
                  <a href="${r.explorer}" target="_blank"
                     style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--lavender-dark);">
                    ${r.signature?.slice(0, 12)}â€¦â†—
                  </a>
                </td>
                <td>${new Date(r.timestamp).toLocaleTimeString('en-IN')}</td>
                <td><span class="status-pill ${r.mock ? 'sp-trial' : 'sp-active'}">${r.mock ? 'mock' : 'devnet'}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>`
      }
    </div>

    <!-- Recent Runs -->
    <div class="dash-widget">
      <div class="widget-title">Run History</div>
      ${runs.length === 0
        ? '<div style="font-size:0.78rem;color:var(--ink-soft);">No runs yet.</div>'
        : `<table class="sub-table">
            <thead><tr><th>Run ID</th><th>Agent</th><th>Credits</th><th>Signal</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              ${runs.map(r => `<tr>
                <td style="font-family:'DM Mono',monospace;font-size:0.62rem;">${r.run_id}</td>
                <td>${r.agent_name}</td>
                <td>âˆ’${r.credits_used}</td>
                <td style="font-weight:600;color:${r.result?.signal === 'BUY' ? 'var(--olive)' : r.result?.signal === 'SELL' ? '#A32D2D' : 'var(--ink-mid)'};">
                  ${r.result?.signal || 'â€”'}
                </td>
                <td><span class="status-pill ${r.status === 'completed' ? 'sp-active' : r.status === 'failed' ? 'sp-paused' : 'sp-trial'}">${r.status}</span></td>
                <td>${new Date(r.created_at).toLocaleTimeString('en-IN')}</td>
              </tr>`).join('')}
            </tbody>
          </table>`
      }
    </div>
  `;
},
```

### Step 3.2 â€” Add `runDemoAgent()` to `dashboard.js`

```javascript
// Add to dashboard.js

const API = {
  // ... existing API calls ...
  agentRuns:  () => fetch('/api/agent/runs').then(r => r.json()),
  settlement: () => fetch('/api/solana/settlement-log').then(r => r.json()),
  runAgent:   (userId) => fetch('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, agentName: 'Trading Signal Agent' }),
  }).then(r => r.json()),
};

async function runDemoAgent() {
  const btn = document.getElementById('run-agent-btn');
  const output = document.getElementById('agent-run-output');

  // Get a demo userId (in real app, this comes from auth)
  const demoUserId = sessionStorage.getItem('dodoarc_demo_user') || 'demo_user_001';

  btn.textContent = 'â³ Running agentâ€¦';
  btn.disabled = true;
  output.style.display = 'block';
  output.innerHTML = `
    <div style="font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--ink-soft);line-height:1.8;">
      <div>ðŸ“Š Calling market-data tool via x402â€¦</div>
      <div>ðŸ’¬ Calling sentiment-feed tool via x402â€¦</div>
      <div>âš¡ Calling signal-engine tool via x402â€¦</div>
      <div style="color:var(--olive);">Settling USDC on Solana devnetâ€¦</div>
    </div>`;

  try {
    const data = await API.runAgent(demoUserId);

    if (!data.success) {
      output.innerHTML = `<div style="color:#A32D2D;font-size:0.8rem;">âŒ ${data.error}</div>`;
      return;
    }

    const r = data.result;
    const signalColor = r.signal === 'BUY' ? 'var(--olive)' : r.signal === 'SELL' ? '#A32D2D' : 'var(--gold)';

    output.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div style="background:var(--white);padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--cream-dark);">
          <div style="font-size:0.65rem;color:var(--ink-soft);margin-bottom:4px;">SIGNAL</div>
          <div style="font-size:1.4rem;font-weight:600;color:${signalColor};">${r.signal}</div>
          <div style="font-size:0.7rem;color:var(--ink-soft);">${r.confidence}% confidence Â· ${r.sentiment}</div>
        </div>
        <div style="background:var(--white);padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--cream-dark);">
          <div style="font-size:0.65rem;color:var(--ink-soft);margin-bottom:4px;">x402 SETTLED</div>
          <div style="font-size:1.2rem;font-weight:600;color:var(--ink);">${r.totalUsdcSettled.toFixed(4)} USDC</div>
          <div style="font-size:0.7rem;color:var(--ink-soft);">${r.receipts.length} tool calls Â· Solana devnet${r.mock ? ' (mock)' : ''}</div>
        </div>
      </div>
      <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--ink-soft);line-height:1.9;">
        ${r.logs.map(l => `<div>${l}</div>`).join('')}
      </div>
      <div style="margin-top:8px;">
        ${r.receipts.map(rec => `
          <a href="${rec.explorer}" target="_blank" style="
            display:inline-flex;align-items:center;gap:4px;
            font-family:'DM Mono',monospace;font-size:0.6rem;
            color:var(--lavender-dark);margin-right:8px;
          ">â†— ${rec.tool} Â· ${rec.signature.slice(0,10)}â€¦</a>
        `).join('')}
      </div>`;

    // Refresh agent view to show updated run history
    setTimeout(() => renderView('agents'), 1500);

  } catch (err) {
    output.innerHTML = `<div style="color:#A32D2D;font-size:0.8rem;">âŒ Error: ${err.message}</div>`;
  } finally {
    btn.textContent = 'â–¶ Run Agent (10 credits)';
    btn.disabled = false;
  }
}
```

### Step 3.3 â€” Add Settlement Widget to Overview

Update `settlementWidget()` in `dashboard.js` to fetch real data:

```javascript
// Replace existing settlementWidget() with:
async function settlementWidgetLive() {
  const { receipts = [], totalSettled = 0 } = await API.settlement().catch(() => ({}));

  const rows = receipts.slice(0, 4).map(r => `
    <div class="settlement-row">
      <div>
        <a href="${r.explorer}" target="_blank" class="settle-hash">${r.signature?.slice(0,8)}â€¦â†—</a>
        <div style="font-size:0.65rem;color:var(--ink-soft);">${r.tool} Â· ${new Date(r.timestamp).toLocaleTimeString('en-IN')}</div>
      </div>
      <div class="settle-amount">${r.amountUsdc} USDC</div>
      <div class="settle-status">âœ“ ${r.mock ? 'mock' : 'devnet'}</div>
    </div>`).join('') || '<div style="font-size:0.75rem;color:var(--ink-soft);">No settlements yet. Run an agent to trigger x402.</div>';

  return `<div class="dash-widget">
    <div class="widget-title">Solana Settlements (x402) <span class="widget-badge wb-sync">On-chain</span></div>
    ${rows}
    ${totalSettled > 0 ? `
      <div style="margin-top:10px;padding:6px 8px;background:var(--olive-mist);border-radius:var(--r-sm);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.7rem;color:var(--olive-dark);font-weight:500;">Total settled</span>
        <span style="font-family:'DM Mono',monospace;font-size:0.75rem;color:var(--olive-dark);font-weight:600;">${totalSettled.toFixed(4)} USDC</span>
      </div>` : ''}
  </div>`;
}
```

---

## Part 4 â€” Devnet Setup Script

Run this once to fund your devnet wallet before the demo:

```javascript
// scripts/setup-devnet.js
// Run: node scripts/setup-devnet.js

require('dotenv').config();
const { airdropSol, getUsdcBalance, getPayerKeypair } = require('./src/services/solana');

async function setup() {
  const payer = getPayerKeypair();
  const wallet = payer.publicKey.toString();

  console.log('DodoArc devnet setup');
  console.log('Wallet:', wallet);
  console.log('Explorer:', `https://explorer.solana.com/address/${wallet}?cluster=devnet`);

  // Airdrop SOL for gas
  console.log('\nRequesting 2 SOL airdropâ€¦');
  try {
    const sig = await airdropSol(wallet, 2);
    console.log('Airdrop:', sig.signature);
  } catch (e) {
    console.warn('Airdrop failed (rate limit?) â€” try https://faucet.solana.com manually');
  }

  // Check USDC balance
  const usdc = await getUsdcBalance(wallet);
  console.log('\nDevnet USDC balance:', usdc);
  if (usdc < 0.01) {
    console.log('âš ï¸  Need devnet USDC. Get some at: https://faucet.circle.com (select devnet)');
  }

  console.log('\nâœ… Devnet setup complete.');
  console.log('Add to .env: SOLANA_PRIVATE_KEY=<base58 key from your devnet wallet>');
}

setup().catch(console.error);
```

---

## Part 5 â€” New Tests

Add `tests/agent.test.js`:

```javascript
// tests/agent.test.js

const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

describe('Agent Run â€” Milestone 3', () => {

  let testUserId;

  beforeAll(() => {
    // Create a test user with an active subscription + credits
    const user = db.getOrCreateUser('agenttest@dodoarc.xyz', 'Agent Test');
    testUserId = user.id;
    const existingSub = db.getSubscriptionByUser(testUserId);
    if (!existingSub) {
      db.createSubscription({
        userId: testUserId,
        planId: 'plan_pro',
        status: 'active',
        credits_total: 100,
        credits_used: 0,
      });
    }
  });

  test('POST /api/agent/run returns success with signal and receipts', async () => {
    const res = await request(app)
      .post('/api/agent/run')
      .send({ userId: testUserId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.creditsUsed).toBe(10);
    expect(res.body.result).toBeDefined();
    expect(['BUY', 'HOLD', 'SELL']).toContain(res.body.result.signal);
    expect(res.body.result.receipts).toHaveLength(3);
  });

  test('agent run deducts 10 credits from user account', async () => {
    const before = db.getRemainingCredits(testUserId);
    await request(app).post('/api/agent/run').send({ userId: testUserId });
    const after = db.getRemainingCredits(testUserId);
    expect(before - after).toBe(10);
  });

  test('agent run stores settlement receipts in DB', async () => {
    await request(app).post('/api/agent/run').send({ userId: testUserId });
    const settlements = db.getRecentSettlements();
    expect(settlements.length).toBeGreaterThan(0);
    expect(settlements[0].tx_signature).toBeDefined();
    expect(settlements[0].amount_usdc).toBeGreaterThan(0);
  });

  test('GET /api/agent/runs returns run history', async () => {
    const res = await request(app).get('/api/agent/runs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.runs)).toBe(true);
  });

  test('GET /api/solana/settlement-log returns receipts', async () => {
    const res = await request(app).get('/api/solana/settlement-log');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.receipts)).toBe(true);
    expect(typeof res.body.totalSettled).toBe('number');
  });

  test('agent run fails with 402 when user has no credits', async () => {
    const brokeUser = db.getOrCreateUser('broke@dodoarc.xyz', 'Broke User');
    const res = await request(app)
      .post('/api/agent/run')
      .send({ userId: brokeUser.id });
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/credit|subscription/i);
  });

  test('POST /api/agent/run returns 400 without userId', async () => {
    const res = await request(app).post('/api/agent/run').send({});
    expect(res.status).toBe(400);
  });
});
```

---

## Milestone 3 Completion Checklist

### Wallet Connect
- [ ] "Connect Phantom" button visible in dashboard topbar
- [ ] Clicking connects Phantom wallet (or falls back to demo mode gracefully)
- [ ] Connected wallet address shown (truncated: `Ab12...Xy34`)
- [ ] `POST /api/solana/connect-wallet` saves wallet to backend
- [ ] `GET /api/solana/wallet-status` returns connected wallet info
- [ ] Wallet state persists across sidebar view switches (sessionStorage)
- [ ] Disconnect button works

### Demo Agent
- [ ] `POST /api/agent/run` accepts `{ userId }` and returns signal + receipts
- [ ] Credits deducted before agent runs (prevents running with 0 credits)
- [ ] 3 x402 payments triggered per run (market-data, sentiment-feed, signal-engine)
- [ ] Each payment stored in `settlement_receipts` table with tx signature
- [ ] Mock mode works when no `SOLANA_PRIVATE_KEY` is configured
- [ ] `GET /api/agent/runs` returns run history
- [ ] Dashboard "Agents" tab shows run agent button + output + settlement log + run history

### Settlement
- [ ] `GET /api/solana/settlement-log` returns real DB receipts (not mock data)
- [ ] Explorer links in settlement log are real Solana devnet URLs
- [ ] Overview dashboard settlement widget shows live receipts
- [ ] Total USDC settled shown in dashboard

### Tests
- [ ] `npm test` passes: minimum 15 tests across 3 suites
- [ ] Agent run success test passes
- [ ] Credit deduction test passes (before - after = 10)
- [ ] Settlement stored in DB test passes
- [ ] 402 on no credits test passes

### Devnet
- [ ] `node scripts/setup-devnet.js` runs without error
- [ ] Payer wallet shown in console with explorer link
- [ ] Real devnet transfers work when `SOLANA_PRIVATE_KEY` is set

---

## Quick Reference â€” New Files in Milestone 3

| File | Action | What it does |
|------|--------|--------------|
| `src/services/solana.js` | **Rewrite** | Real x402 USDC transfers on devnet |
| `src/services/agent.js` | **Create** | Demo trading agent with 3 x402 tool calls |
| `src/routes/agent.js` | **Create** | `POST /api/agent/run`, `GET /api/agent/runs` |
| `src/routes/solana.js` | **Update** | Add wallet connect + real settlement log |
| `src/services/db.js` | **Update** | Add `logSettlement`, `getRecentSettlements`, `logAgentRun`, `completeAgentRun` |
| `src/services/sqlite.js` | **Update** | Add `settlement_receipts` + `agent_runs` tables |
| `public/dashboard.js` | **Update** | Add wallet connect logic + agents view + `runDemoAgent()` |
| `public/dashboard.html` | **Update** | Add wallet connect button to topbar |
| `tests/agent.test.js` | **Create** | 7 new agent tests |
| `scripts/setup-devnet.js` | **Create** | One-time devnet wallet funding |

---

*DodoArc â€” Billing OS for AI Agent Products | Colosseum Frontier 2026 | Milestone 3*
