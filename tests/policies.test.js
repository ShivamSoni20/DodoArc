const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

async function setup() {
  const devBody = await request(app)
    .post('/api/developer/register')
    .send({ email: 'policy@dodoarc.xyz', name: 'Policy Dev' })
    .expect(201)
    .then((response) => response.body);

  const apiKey = devBody.apiKey.key;
  const developerId = devBody.developer.id;

  const appBody = await request(app)
    .post('/api/developer/apps')
    .set('x-api-key', apiKey)
    .send({ name: 'Policy App', planId: 'plan_pro' })
    .expect(201)
    .then((response) => response.body);

  const user = db.getOrCreateUser('policyuser@dodoarc.xyz', 'Policy User');
  db.createSubscription({
    userId: user.id,
    planId: 'plan_pro',
    status: 'active',
    credits_total: 500,
    credits_used: 0,
    developer_id: developerId,
    app_id: appBody.app.id
  });
  db.registerAppUser(appBody.app.id, developerId, user.id);

  return { apiKey, developerId, appId: appBody.app.id, userId: user.id };
}

test('GET /api/developer/apps/:appId/policy returns default policy', async () => {
  const { apiKey, appId } = await setup();
  const res = await request(app)
    .get(`/api/developer/apps/${appId}/policy`)
    .set('x-api-key', apiKey)
    .expect(200);

  expect(res.body.policy.max_credits_per_run).toBeDefined();
  expect(res.body.policy.daily_spend_cap).toBeDefined();
  expect(res.body.policy.paused).toBe(false);
});

test('PUT policy updates spend limits', async () => {
  const { apiKey, appId } = await setup();
  await request(app)
    .put(`/api/developer/apps/${appId}/policy`)
    .set('x-api-key', apiKey)
    .send({ daily_spend_cap: 100, max_credits_per_run: 20 })
    .expect(200);

  const res = await request(app)
    .get(`/api/developer/apps/${appId}/policy`)
    .set('x-api-key', apiKey)
    .expect(200);

  expect(res.body.policy.daily_spend_cap).toBe(100);
  expect(res.body.policy.max_credits_per_run).toBe(20);
});

test('paused app blocks agent run with 403', async () => {
  const { apiKey, appId, userId } = await setup();
  await request(app).post(`/api/developer/apps/${appId}/pause`).set('x-api-key', apiKey).expect(200);

  const res = await request(app)
    .post('/api/agent/run')
    .set('x-api-key', apiKey)
    .send({ userId, appId })
    .expect(403);

  expect(res.body.code).toBe('APP_PAUSED');
});

test('resuming app allows agent run again', async () => {
  const { apiKey, appId, userId } = await setup();
  await request(app).post(`/api/developer/apps/${appId}/pause`).set('x-api-key', apiKey).expect(200);
  await request(app).post(`/api/developer/apps/${appId}/resume`).set('x-api-key', apiKey).expect(200);

  const res = await request(app)
    .post('/api/agent/run')
    .set('x-api-key', apiKey)
    .send({ userId, appId })
    .expect(200);

  expect(res.body.success).toBe(true);
});

test('daily cap exceeded returns 402 with DAILY_CAP_EXCEEDED code', async () => {
  const { apiKey, appId, userId } = await setup();
  await request(app)
    .put(`/api/developer/apps/${appId}/policy`)
    .set('x-api-key', apiKey)
    .send({ daily_spend_cap: 0 })
    .expect(200);

  const res = await request(app)
    .post('/api/agent/run')
    .set('x-api-key', apiKey)
    .send({ userId, appId })
    .expect(402);

  expect(res.body.code).toBe('DAILY_CAP_EXCEEDED');
});

test('GET /api/developer/apps/:appId/users returns app users', async () => {
  const { apiKey, appId } = await setup();
  const res = await request(app)
    .get(`/api/developer/apps/${appId}/users`)
    .set('x-api-key', apiKey)
    .expect(200);

  expect(Array.isArray(res.body.users)).toBe(true);
  expect(res.body.users).toHaveLength(1);
});
