require('dotenv').config();

const fs = require('fs');
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

app.get('*', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const injected = html.includes('/app.js')
    ? html
    : html.replace('</body>', '<script src="/app.js"></script>\n</body>');
  res.type('html').send(injected);
});

if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`DodoArc running at ${config.BASE_URL}`);
    console.log(`Dodo mode: ${config.DODO_PAYMENTS_ENVIRONMENT}`);
  });
}

module.exports = app;
