const router = require('express').Router();
const db = require('../services/db');
const { requireApiKey } = require('../middleware/auth');
const config = require('../config');

function publicDeveloper(developer) {
  return {
    id: developer.id,
    email: developer.email,
    name: developer.name,
    created_at: developer.created_at
  };
}

function generateEmbedCode(app) {
  const baseUrl = config.BASE_URL;
  return [
    '<!-- DodoArc Checkout Embed -->',
    `<script src="${baseUrl}/embed/dodoarc.js"></script>`,
    '<script>',
    '  DodoArc.renderButton("#dodoarc-checkout", {',
    `    appId: "${app.id}",`,
    `    planId: "${app.planId}",`,
    '    buttonText: "Subscribe with DodoArc"',
    '  });',
    '</script>'
  ].join('\n');
}

function enrichApp(app) {
  return {
    ...app,
    embed: generateEmbedCode(app),
    checkoutUrl: `/checkout/${app.id}`
  };
}

router.post('/register', (req, res) => {
  const { email, name } = req.body;
  if (!email || !String(email).includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const existing = db.getDeveloperByEmail(email);
  if (existing) {
    return res.status(409).json({
      error: 'Email already registered',
      hint: 'Use POST /api/developer/keys with your existing API key to generate another key.'
    });
  }

  const developer = db.createDeveloper(email, name);
  const apiKey = db.generateApiKey(developer.id, 'Default Key');
  db.logEvent('developer_registered', { developerId: developer.id, email: developer.email });

  res.status(201).json({
    success: true,
    developer: publicDeveloper(developer),
    apiKey: {
      key: apiKey.key,
      prefix: apiKey.prefix,
      warning: 'Save this key now. It will not be shown again.'
    }
  });
});

router.get('/me', requireApiKey, (req, res) => {
  const developer = db.getDeveloperById(req.developer.id);
  res.json({
    developer: publicDeveloper(developer),
    apps: db.getAppsByDeveloper(req.developer.id).map(enrichApp),
    keys: db.getApiKeysByDeveloper(req.developer.id)
  });
});

router.post('/apps', requireApiKey, (req, res) => {
  const { name, description, planId = 'plan_pro', creditsPerRun = 10 } = req.body;
  if (!name) return res.status(400).json({ error: 'App name required' });
  if (!db.getPlanById(planId)) return res.status(400).json({ error: 'Unknown planId' });

  const app = db.createApp(req.developer.id, { name, description, planId, creditsPerRun });
  db.logEvent('app_created', { developerId: req.developer.id, appId: app.id, name: app.name });

  res.status(201).json({
    success: true,
    app,
    embed: generateEmbedCode(app),
    checkoutUrl: `/checkout/${app.id}`
  });
});

router.get('/apps', requireApiKey, (req, res) => {
  res.json({ apps: db.getAppsByDeveloper(req.developer.id).map(enrichApp) });
});

router.post('/keys', requireApiKey, (req, res) => {
  const apiKey = db.generateApiKey(req.developer.id, req.body.name || 'New Key');
  res.status(201).json({
    success: true,
    apiKey: {
      key: apiKey.key,
      prefix: apiKey.prefix,
      warning: 'Save this key now. It will not be shown again.'
    }
  });
});

router.get('/keys', requireApiKey, (req, res) => {
  res.json({ keys: db.getApiKeysByDeveloper(req.developer.id) });
});

router.get('/docs', (req, res) => {
  res.json({
    name: 'DodoArc Developer API',
    version: '1.0.0',
    baseUrl: config.BASE_URL,
    authentication: 'x-api-key: da_live_YOUR_KEY',
    endpoints: {
      register: 'POST /api/developer/register',
      profile: 'GET /api/developer/me',
      createApp: 'POST /api/developer/apps',
      listApps: 'GET /api/developer/apps',
      generateKey: 'POST /api/developer/keys',
      listKeys: 'GET /api/developer/keys',
      runAgent: 'POST /api/agent/run',
      checkCredits: 'GET /api/credits/:userId',
      consumeCredits: 'POST /api/credits/consume',
      settlementLog: 'GET /api/solana/settlement-log'
    },
    quickStart: [
      'POST /api/developer/register to get an API key.',
      'POST /api/developer/apps to create an agent product.',
      'Paste the returned embed code into your site.',
      'Users pay through Dodo checkout and credits activate from webhooks.',
      'Call POST /api/agent/run with x-api-key to consume credits and settle x402 receipts.'
    ]
  });
});

module.exports = router;
