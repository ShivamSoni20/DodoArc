require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./src/config');

const app = express();

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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'DodoArc',
    dodo_environment: config.DODO_PAYMENTS_ENVIRONMENT,
    solana_cluster: config.SOLANA_RPC_URL.includes('devnet') ? 'devnet' : 'custom',
    timestamp: new Date().toISOString()
  });
});

app.get('/checkout/mock-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mock-success.html'));
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
  app.listen(config.PORT, () => {
    console.log(`DodoArc running at ${config.BASE_URL}`);
    console.log(`Dodo mode: ${config.DODO_PAYMENTS_ENVIRONMENT}`);
  });
}

module.exports = app;
