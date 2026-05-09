require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { WebSocketServer } = require('ws');

const config = require('./src/config');
const db = require('./src/services/db');

const app = express();
const wsClients = new Set();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.FRONTEND_URL, credentials: true }));
app.use(morgan('dev'));

app.use('/api/webhook/dodo', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.use('/api/plans', require('./src/routes/plans'));
app.use('/api/checkout', require('./src/routes/checkout'));
app.use('/api/webhook', require('./src/routes/webhook'));
app.use('/api/webhooks', require('./src/routes/webhooks'));
app.use('/api/credits', require('./src/routes/credits'));
app.use('/api/subscriptions', require('./src/routes/subscriptions'));
app.use('/api/solana', require('./src/routes/solana'));
app.use('/api/agent', require('./src/routes/agent'));
app.use('/api/developer', require('./src/routes/developer'));
app.use('/api/dashboard', require('./src/routes/metrics'));
app.use('/api/demo', require('./src/routes/demo'));

app.locals.broadcast = (eventType, data = {}) => {
  const message = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() });
  for (const client of wsClients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
};

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'DodoArc',
    dodo_environment: config.DODO_PAYMENTS_ENVIRONMENT,
    solana_cluster: config.SOLANA_RPC_URL.includes('devnet') ? 'devnet' : 'custom',
    dodoConfigured: Boolean(config.DODO_PAYMENTS_API_KEY && config.DODO_PRO_PRODUCT_ID),
    solanaConfigured: Boolean(config.SOLANA_PRIVATE_KEY),
    network: config.SOLANA_RPC_URL.includes('devnet') ? 'devnet' : 'custom',
    timestamp: new Date().toISOString()
  });
});

app.get('/.well-known/mcp', (req, res) => {
  res.json({
    name: 'DodoArc',
    description: 'Billing OS for AI agent products: credits, Dodo checkout, and x402-style Solana settlement.',
    version: '1.0.0',
    mcpServer: {
      command: 'node',
      args: ['mcp.js'],
      transport: 'stdio'
    },
    tools: [
      'check_credits',
      'consume_credits',
      'run_agent',
      'get_settlement_log',
      'get_dashboard_metrics'
    ],
    docs: '/api/developer/docs'
  });
});

app.get('/checkout/mock-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mock-success.html'));
});

app.get('/checkout/:appId', (req, res) => {
  const appRecord = db.getAppById(req.params.appId);
  if (!appRecord) return res.status(404).send('DodoArc app not found');
  const plan = db.getPlanById(appRecord.planId);
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${appRecord.name} - DodoArc Checkout</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F7F3EC;color:#2A2820;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(420px,calc(100vw - 32px));background:#FDFAF5;border:1px solid #EDE8DE;border-radius:16px;padding:28px;box-shadow:0 16px 50px rgba(42,40,32,.12)}
    h1{margin:0 0 6px;font-size:26px} p{color:#7A7568;line-height:1.6} #dodoarc-checkout{margin-top:18px}
  </style>
</head>
<body>
  <main>
    <div style="font-size:12px;color:#6B7C5C;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">DodoArc checkout</div>
    <h1>${escapeHtml(appRecord.name)}</h1>
    <p>${escapeHtml(appRecord.description || 'Subscribe to activate AI agent credits.')}</p>
    <p><strong>${escapeHtml(plan?.display_price || 'Plan')}</strong></p>
    <div id="dodoarc-checkout"></div>
  </main>
  <script src="/embed/dodoarc.js"></script>
  <script>
    DodoArc.renderButton('#dodoarc-checkout', {
      appId: ${JSON.stringify(appRecord.id)},
      planId: ${JSON.stringify(appRecord.planId)},
      buttonText: 'Continue to payment'
    });
  </script>
</body>
</html>`);
});

app.get('/dashboard', (req, res) => {
  const providedKey = req.query.key || req.headers['x-dashboard-key'];
  if (config.DASHBOARD_API_KEY && providedKey !== config.DASHBOARD_API_KEY) {
    return res.status(401).send('Dashboard API key required. Pass ?key=YOUR_KEY or x-dashboard-key.');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({ type: 'connected', data: { app: 'DodoArc' }, timestamp: new Date().toISOString() }));
    const ping = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.ping();
    }, 30000);
    ws.on('close', () => {
      clearInterval(ping);
      wsClients.delete(ws);
    });
  });

  server.listen(config.PORT, () => {
    console.log(`DodoArc running at ${config.BASE_URL}`);
    console.log(`Dodo mode: ${config.DODO_PAYMENTS_ENVIRONMENT}`);
  });
}

module.exports = app;
