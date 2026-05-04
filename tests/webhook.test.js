const crypto = require('crypto');
const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

function signedHeaders(payload, secret = 'test_secret') {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('base64');

  return {
    'content-type': 'application/json',
    'webhook-id': `evt_${Date.now()}`,
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${signature}`
  };
}

test('payment.succeeded webhook activates pro credits', async () => {
  process.env.DODO_PAYMENTS_WEBHOOK_SECRET = 'test_secret';

  const payload = JSON.stringify({
    type: 'payment.succeeded',
    data: {
      payment_id: 'pay_test_001',
      total_amount: 299900,
      currency: 'INR',
      customer: { email: 'paid@example.com', name: 'Paid User' },
      metadata: { planId: 'plan_pro', email: 'paid@example.com' }
    }
  });

  await request(app)
    .post('/api/webhook/dodo')
    .set(signedHeaders(payload))
    .send(payload)
    .expect(200);

  const subscriptions = await request(app).get('/api/subscriptions').expect(200);
  expect(subscriptions.body.total).toBe(1);
  expect(subscriptions.body.subscriptions[0].credits_total).toBe(1000);
});
