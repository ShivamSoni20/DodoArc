const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

function createApiKey(email = 'credits-dev@dodoarc.xyz') {
  const developer = db.createDeveloper(email, 'Credits Dev');
  return {
    developer,
    key: db.generateApiKey(developer.id, 'Test Key').key
  };
}

function createScopedSubscription(email = 'consume@example.com') {
  const developer = db.createDeveloper(`dev-${Date.now()}@dodoarc.xyz`, 'Scoped Credits Dev');
  const app = db.createApp(developer.id, {
    name: 'Scoped Credits App',
    description: 'Scoped credits test app',
    planId: 'plan_starter'
  });
  const user = db.getOrCreateUser(email, 'Scoped Credits User');
  db.createSubscription({
    userId: user.id,
    planId: 'plan_starter',
    status: 'active',
    credits_total: 100,
    credits_used: 0,
    payment_method: 'test',
    developer_id: developer.id,
    app_id: app.id
  });
  db.registerAppUser(app.id, developer.id, user.id);
  return {
    user,
    app,
    developer,
    apiKey: db.generateApiKey(developer.id, 'Scoped Credits Key').key
  };
}

test('starter checkout activates a free subscription immediately', async () => {
  const response = await request(app)
    .post('/api/checkout/create')
    .send({ planId: 'plan_starter', email: 'starter@example.com', name: 'Starter User' })
    .expect(200);

  expect(response.body.type).toBe('free');

  const subscriptions = await request(app).get('/api/subscriptions').expect(200);
  expect(subscriptions.body.total).toBe(1);
  expect(subscriptions.body.subscriptions[0].credits_total).toBe(100);
});

test('credits can be consumed from an active subscription', async () => {
  const scoped = createScopedSubscription();

  const result = await request(app)
    .post('/api/credits/consume')
    .set('x-api-key', scoped.apiKey)
    .send({ userId: scoped.user.id, appId: scoped.app.id, amount: 25, agentName: 'Research Agent' })
    .expect(200);

  expect(result.body.remaining).toBe(75);
});

test('credit consumption returns 404 without an active scoped subscription', async () => {
  const { key } = createApiKey('no-sub-dev@dodoarc.xyz');
  await request(app)
    .post('/api/credits/consume')
    .set('x-api-key', key)
    .send({ userId: 'missing_user', amount: 1 })
    .expect(404);
});

test('credit consumption requires an API key', async () => {
  await request(app)
    .post('/api/credits/consume')
    .send({ userId: 'missing_user', amount: 1 })
    .expect(401);
});
