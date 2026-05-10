const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

function createCreditedUser(email = 'agenttest@dodoarc.xyz') {
  const developer = db.createDeveloper(`agent-dev-${Date.now()}@dodoarc.xyz`, 'Agent Dev');
  const app = db.createApp(developer.id, {
    name: 'Agent Test App',
    description: 'Scoped agent test app',
    planId: 'plan_pro'
  });
  const user = db.getOrCreateUser(email, 'Agent Test');
  db.createSubscription({
    userId: user.id,
    planId: 'plan_pro',
    status: 'active',
    credits_total: 100,
    credits_used: 0,
    payment_method: 'test',
    developer_id: developer.id,
    app_id: app.id
  });
  db.registerAppUser(app.id, developer.id, user.id);
  const apiKey = db.generateApiKey(developer.id, 'Test Key').key;
  return { user, developer, app, apiKey };
}

function createApiKey(email = 'agent-dev@dodoarc.xyz') {
  const developer = db.createDeveloper(email, 'Agent Dev');
  return db.generateApiKey(developer.id, 'Test Key').key;
}

test('POST /api/agent/run returns signal and three x402 receipts', async () => {
  const scoped = createCreditedUser();

  const response = await request(app)
    .post('/api/agent/run')
    .set('x-api-key', scoped.apiKey)
    .send({ userId: scoped.user.id, appId: scoped.app.id })
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.creditsUsed).toBe(10);
  expect(['BUY', 'HOLD', 'SELL']).toContain(response.body.result.signal);
  expect(response.body.result.receipts).toHaveLength(3);
});

test('agent run deducts 10 credits', async () => {
  const scoped = createCreditedUser('deduct@dodoarc.xyz');
  const before = db.getRemainingCredits(scoped.user.id, { developerId: scoped.developer.id, appId: scoped.app.id });

  await request(app)
    .post('/api/agent/run')
    .set('x-api-key', scoped.apiKey)
    .send({ userId: scoped.user.id, appId: scoped.app.id })
    .expect(200);

  expect(before - db.getRemainingCredits(scoped.user.id, { developerId: scoped.developer.id, appId: scoped.app.id })).toBe(10);
});

test('agent run stores settlement receipts', async () => {
  const scoped = createCreditedUser('settlement@dodoarc.xyz');

  await request(app)
    .post('/api/agent/run')
    .set('x-api-key', scoped.apiKey)
    .send({ userId: scoped.user.id, appId: scoped.app.id })
    .expect(200);

  const settlements = db.getRecentSettlements();
  expect(settlements.length).toBe(3);
  expect(settlements[0].tx_signature).toBeTruthy();
  expect(settlements[0].amount_usdc).toBeGreaterThan(0);
});

test('GET /api/agent/runs returns run history', async () => {
  const scoped = createCreditedUser('runs@dodoarc.xyz');
  await request(app)
    .post('/api/agent/run')
    .set('x-api-key', scoped.apiKey)
    .send({ userId: scoped.user.id, appId: scoped.app.id })
    .expect(200);

  const response = await request(app).get('/api/agent/runs').set('x-api-key', scoped.apiKey).expect(200);

  expect(Array.isArray(response.body.runs)).toBe(true);
  expect(response.body.runs[0].status).toBe('completed');
});

test('GET /api/solana/settlement-log returns receipts and total', async () => {
  const scoped = createCreditedUser('log@dodoarc.xyz');
  await request(app)
    .post('/api/agent/run')
    .set('x-api-key', scoped.apiKey)
    .send({ userId: scoped.user.id, appId: scoped.app.id })
    .expect(200);

  const response = await request(app).get('/api/solana/settlement-log').set('x-api-key', scoped.apiKey).expect(200);

  expect(Array.isArray(response.body.receipts)).toBe(true);
  expect(response.body.receipts.length).toBe(3);
  expect(response.body.totalSettled).toBeGreaterThan(0);
});

test('agent run fails with 404 when user is outside developer scope', async () => {
  const user = db.getOrCreateUser('broke@dodoarc.xyz', 'Broke User');
  const apiKey = createApiKey('broke-dev@dodoarc.xyz');

  const response = await request(app)
    .post('/api/agent/run')
    .set('x-api-key', apiKey)
    .send({ userId: user.id })
    .expect(404);

  expect(response.body.code).toBe('SUBSCRIPTION_SCOPE_MISSING');
});

test('POST /api/agent/run requires an API key', async () => {
  await request(app).post('/api/agent/run').send({}).expect(401);
});

test('POST /api/agent/run returns 400 without userId when authenticated', async () => {
  const apiKey = createApiKey('missing-user-dev@dodoarc.xyz');
  await request(app).post('/api/agent/run').set('x-api-key', apiKey).send({}).expect(400);
});

test('wallet connect status is exposed over Solana API', async () => {
  await request(app)
    .post('/api/solana/connect-wallet')
    .send({ wallet: 'DodoArc1111111111111111111111111111111111111', demo: true })
    .expect(200);

  const response = await request(app).get('/api/solana/wallet-status').expect(200);
  expect(response.body.connected).toBe(true);
  expect(response.body.demo).toBe(true);
});
