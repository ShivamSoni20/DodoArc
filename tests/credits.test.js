const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

function createApiKey(email = 'credits-dev@dodoarc.xyz') {
  const developer = db.createDeveloper(email, 'Credits Dev');
  return db.generateApiKey(developer.id, 'Test Key').key;
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
  const checkout = await request(app)
    .post('/api/checkout/create')
    .send({ planId: 'plan_starter', email: 'consume@example.com' })
    .expect(200);

  const result = await request(app)
    .post('/api/credits/consume')
    .set('x-api-key', createApiKey())
    .send({ userId: checkout.body.user.id, amount: 25, agentName: 'Research Agent' })
    .expect(200);

  expect(result.body.remaining).toBe(75);
});

test('credit consumption returns 402 without an active subscription', async () => {
  await request(app)
    .post('/api/credits/consume')
    .set('x-api-key', createApiKey('no-sub-dev@dodoarc.xyz'))
    .send({ userId: 'missing_user', amount: 1 })
    .expect(402);
});

test('credit consumption requires an API key', async () => {
  await request(app)
    .post('/api/credits/consume')
    .send({ userId: 'missing_user', amount: 1 })
    .expect(401);
});
