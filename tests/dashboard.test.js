const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

function createApiKey(email = 'dashboard-dev@dodoarc.xyz') {
  const developer = db.createDeveloper(email, 'Dashboard Dev');
  return db.generateApiKey(developer.id, 'Dashboard Test Key').key;
}

test('GET /api/dashboard/metrics returns live dashboard fields', async () => {
  const user = db.getOrCreateUser('metrics@dodoarc.xyz', 'Metrics User');
  db.createSubscription({
    userId: user.id,
    planId: 'plan_pro',
    status: 'active',
    credits_total: 1000,
    credits_used: 120,
    payment_method: 'test'
  });

  const response = await request(app).get('/api/dashboard/metrics').expect(200);

  expect(typeof response.body.mrr).toBe('number');
  expect(typeof response.body.mrrFormatted).toBe('string');
  expect(response.body.activeSubscribers).toBe(1);
  expect(response.body.totalCreditsUsed).toBe(120);
  expect(Array.isArray(response.body.monthlyRevenue)).toBe(true);
  expect(response.body.monthlyRevenue).toHaveLength(6);
});

test('monthlyRevenue has month, inr, and usdc fields', async () => {
  const response = await request(app).get('/api/dashboard/metrics').expect(200);
  expect(response.body.monthlyRevenue[0]).toHaveProperty('month');
  expect(response.body.monthlyRevenue[0]).toHaveProperty('inr');
  expect(response.body.monthlyRevenue[0]).toHaveProperty('usdc');
});

test('GET /api/health exposes config flags', async () => {
  const response = await request(app).get('/api/health').expect(200);
  expect(typeof response.body.dodoConfigured).toBe('boolean');
  expect(typeof response.body.solanaConfigured).toBe('boolean');
  expect(response.body.network).toBeDefined();
});

test('GET /api/demo/user creates demo user with subscription', async () => {
  const response = await request(app).get('/api/demo/user').expect(200);
  expect(response.body.user.email).toBe('demo@dodoarc.xyz');
  expect(response.body.subscription.status).toBe('active');
  expect(response.body.subscription.credits_total).toBeGreaterThan(0);
});

test('POST /api/demo/simulate-payment adds credits', async () => {
  const before = await request(app).get('/api/demo/user').expect(200);
  await request(app).post('/api/demo/simulate-payment').expect(200);
  const after = await request(app).get('/api/demo/user').expect(200);

  expect(after.body.subscription.credits_total).toBeGreaterThan(before.body.subscription.credits_total);
});

test('dashboard metrics credit usage increases after agent run', async () => {
  const { body: demo } = await request(app).get('/api/demo/user').expect(200);
  const apiKey = createApiKey();
  const before = await request(app).get('/api/dashboard/metrics').expect(200);

  await request(app)
    .post('/api/agent/run')
    .set('x-api-key', apiKey)
    .send({ userId: demo.user.id })
    .expect(200);

  const after = await request(app).get('/api/dashboard/metrics').expect(200);
  expect(after.body.totalCreditsUsed).toBeGreaterThan(before.body.totalCreditsUsed);
});
