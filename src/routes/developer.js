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
  db.logEvent('app_created', { developerId: req.developer.id, appId: app.id, name: app.name }, { developerId: req.developer.id, appId: app.id });

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

router.put('/apps/:appId/config', requireApiKey, (req, res) => {
  const app = db.getAppById(req.params.appId);
  if (!app || app.developerId !== req.developer.id) {
    return res.status(404).json({ error: 'App not found' });
  }

  const nextPlanId = req.body.planId ?? req.body.plan_id ?? null;
  const nextCreditsPerRun = req.body.creditsPerRun ?? req.body.credits_per_run ?? null;

  if (nextPlanId && !db.getPlanById(nextPlanId)) {
    return res.status(400).json({ error: 'Unknown planId' });
  }
  if (nextCreditsPerRun !== null && (!Number.isFinite(Number(nextCreditsPerRun)) || Number(nextCreditsPerRun) <= 0)) {
    return res.status(400).json({ error: 'creditsPerRun must be a positive number' });
  }

  const updated = db.updateAppConfig(app.id, {
    planId: nextPlanId,
    creditsPerRun: nextCreditsPerRun !== null ? Number(nextCreditsPerRun) : null
  });

  db.logEvent(
    'app_config_updated',
    {
      developerId: req.developer.id,
      appId: app.id,
      planId: updated.planId,
      creditsPerRun: updated.creditsPerRun
    },
    { developerId: req.developer.id, appId: app.id }
  );

  res.json({ success: true, app: enrichApp(updated) });
});

router.put('/apps/:appId/billing', requireApiKey, (req, res) => {
  const app = db.getAppById(req.params.appId);
  if (!app || app.developerId !== req.developer.id) {
    return res.status(404).json({ error: 'App not found' });
  }

  const dodoApiKey = String(req.body.dodo_api_key ?? req.body.dodoApiKey ?? '').trim();
  const dodoProductId = String(req.body.dodo_product_id ?? req.body.dodoProductId ?? '').trim();
  const dodoWebhookSecret = String(req.body.dodo_webhook_secret ?? req.body.dodoWebhookSecret ?? '').trim();

  if (!dodoApiKey || !dodoProductId || !dodoWebhookSecret) {
    return res.status(400).json({
      error: 'dodo_api_key, dodo_product_id, and dodo_webhook_secret are required'
    });
  }

  const updated = db.updateAppBilling(app.id, {
    dodo_api_key: dodoApiKey,
    dodo_product_id: dodoProductId,
    dodo_webhook_secret: dodoWebhookSecret
  });

  db.logEvent(
    'app_billing_connected',
    { developerId: req.developer.id, appId: app.id, billingConnected: updated.billingConnected },
    { developerId: req.developer.id, appId: app.id }
  );

  res.json({
    success: true,
    app: enrichApp(updated),
    billing: updated.billing
  });
});

router.get('/apps/:appId/policy', requireApiKey, (req, res) => {
  const app = db.getAppById(req.params.appId);
  if (!app || app.developerId !== req.developer.id) {
    return res.status(404).json({ error: 'App not found' });
  }
  db.ensureAppPolicy(app.id, req.developer.id);
  res.json({ policy: db.getAppPolicy(app.id), appId: app.id });
});

router.put('/apps/:appId/policy', requireApiKey, (req, res) => {
  const app = db.getAppById(req.params.appId);
  if (!app || app.developerId !== req.developer.id) {
    return res.status(404).json({ error: 'App not found' });
  }

  const { max_credits_per_run, daily_spend_cap, allowed_tools, require_approval_above, paused } = req.body;
  db.ensureAppPolicy(app.id, req.developer.id);
  const policy = db.updateAppPolicy(app.id, {
    max_credits_per_run: max_credits_per_run ?? null,
    daily_spend_cap: daily_spend_cap ?? null,
    allowed_tools: allowed_tools ? JSON.stringify(allowed_tools) : null,
    require_approval_above: require_approval_above ?? null,
    paused: paused !== undefined ? (paused ? 1 : 0) : null
  });

  db.logEvent('policy_updated', { appId: app.id, developerId: req.developer.id, updates: req.body }, { developerId: req.developer.id, appId: app.id });
  res.json({ success: true, policy });
});

router.post('/apps/:appId/pause', requireApiKey, (req, res) => {
  const app = db.getAppById(req.params.appId);
  if (!app || app.developerId !== req.developer.id) {
    return res.status(404).json({ error: 'App not found' });
  }
  db.ensureAppPolicy(app.id, req.developer.id);
  db.updateAppPolicy(app.id, { paused: 1 });
  db.logEvent('app_paused', { appId: app.id, developerId: req.developer.id }, { developerId: req.developer.id, appId: app.id });
  req.app.locals.broadcast?.('app_paused', { appId: app.id });
  res.json({ success: true, appId: app.id, paused: true });
});

router.post('/apps/:appId/resume', requireApiKey, (req, res) => {
  const app = db.getAppById(req.params.appId);
  if (!app || app.developerId !== req.developer.id) {
    return res.status(404).json({ error: 'App not found' });
  }
  db.ensureAppPolicy(app.id, req.developer.id);
  db.updateAppPolicy(app.id, { paused: 0 });
  db.logEvent('app_resumed', { appId: app.id, developerId: req.developer.id }, { developerId: req.developer.id, appId: app.id });
  req.app.locals.broadcast?.('app_resumed', { appId: app.id });
  res.json({ success: true, appId: app.id, paused: false });
});

router.get('/apps/:appId/users', requireApiKey, (req, res) => {
  const app = db.getAppById(req.params.appId);
  if (!app || app.developerId !== req.developer.id) {
    return res.status(404).json({ error: 'App not found' });
  }
  const users = db.getUsersByApp(app.id);
  res.json({ users, appId: app.id, count: users.length });
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
      updateAppConfig: 'PUT /api/developer/apps/:appId/config',
      connectBilling: 'PUT /api/developer/apps/:appId/billing',
      getPolicy: 'GET /api/developer/apps/:appId/policy',
      updatePolicy: 'PUT /api/developer/apps/:appId/policy',
      pauseApp: 'POST /api/developer/apps/:appId/pause',
      resumeApp: 'POST /api/developer/apps/:appId/resume',
      listUsers: 'GET /api/developer/apps/:appId/users',
      generateKey: 'POST /api/developer/keys',
      listKeys: 'GET /api/developer/keys',
      runAgent: 'POST /api/agent/run',
      checkCredits: 'GET /api/credits/:userId',
      consumeCredits: 'POST /api/credits/consume',
      settlementLog: 'GET /api/solana/settlement-log'
    },
    quickStart: [
      'POST /api/developer/register to get an API key.',
      'POST /api/developer/apps to create an app integration.',
      'PUT /api/developer/apps/:appId/config to map a billing plan to credits and set credits consumed per backend run.',
      'PUT /api/developer/apps/:appId/billing to connect the founder-owned Dodo API key, product, and webhook secret.',
      'Each app gets a default spend policy that can cap, pause, or block agent usage.',
      'Paste the returned embed code into your site.',
      'Users pay through Dodo checkout and credits activate from webhooks.',
      'Call POST /api/agent/run with x-api-key to consume credits and settle x402 receipts.'
    ]
  });
});

module.exports = router;
