const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

const paymentSucceeded = (id, email = 'paid@example.com') => ({
  id,
  type: 'payment.succeeded',
  data: {
    payment_id: `pay_${id}`,
    total_amount: 299900,
    currency: 'INR',
    customer: { email, name: 'Paid User' },
    metadata: { planId: 'plan_pro', email, name: 'Paid User' }
  }
});

test('payment.succeeded webhook activates pro credits', async () => {
  await request(app)
    .post('/api/webhook/dodo')
    .set('webhook-id', 'evt_activate_001')
    .send(paymentSucceeded('evt_activate_001'))
    .expect(200);

  const subscriptions = await request(app).get('/api/subscriptions').expect(200);
  expect(subscriptions.body.total).toBe(1);
  expect(subscriptions.body.subscriptions[0].credits_total).toBe(1000);
});

test('idempotency returns duplicate=true on second delivery', async () => {
  const event = paymentSucceeded('evt_duplicate_001', 'duplicate@example.com');

  await request(app).post('/api/webhook/dodo').set('webhook-id', event.id).send(event).expect(200);
  const duplicate = await request(app)
    .post('/api/webhook/dodo')
    .set('webhook-id', event.id)
    .send(event)
    .expect(200);

  expect(duplicate.body.duplicate).toBe(true);
});

test('duplicate webhook does not double grant credits', async () => {
  const email = 'nodouble@example.com';
  const event = paymentSucceeded('evt_nodouble_001', email);

  await request(app).post('/api/webhook/dodo').set('webhook-id', event.id).send(event).expect(200);
  await request(app).post('/api/webhook/dodo').set('webhook-id', event.id).send(event).expect(200);

  const user = db.getOrCreateUser(email, 'No Double');
  const subscription = db.getSubscriptionByUser(user.id);
  expect(subscription.credits_total).toBe(1000);
});

test('payment.failed pauses an existing subscription', async () => {
  const email = 'pause@example.com';
  await request(app)
    .post('/api/webhook/dodo')
    .set('webhook-id', 'evt_pause_activate')
    .send(paymentSucceeded('evt_pause_activate', email))
    .expect(200);

  await request(app)
    .post('/api/webhook/dodo')
    .set('webhook-id', 'evt_pause_fail')
    .send({
      id: 'evt_pause_fail',
      type: 'payment.failed',
      data: { payment_id: 'pay_failed', customer: { email }, metadata: { email } }
    })
    .expect(200);

  const user = db.getOrCreateUser(email, 'Pause User');
  const subscription = db.getSubscriptionByUser(user.id);
  expect(subscription.status).toBe('paused');
});

test('refund webhook freezes an existing subscription', async () => {
  const email = 'refund@example.com';
  await request(app)
    .post('/api/webhook/dodo')
    .set('webhook-id', 'evt_refund_activate')
    .send(paymentSucceeded('evt_refund_activate', email))
    .expect(200);

  await request(app)
    .post('/api/webhook/dodo')
    .set('webhook-id', 'evt_refund_freeze')
    .send({
      id: 'evt_refund_freeze',
      type: 'payment.refunded',
      data: { payment_id: 'pay_refund', customer: { email }, metadata: { email } }
    })
    .expect(200);

  const user = db.getOrCreateUser(email, 'Refund User');
  const subscription = db.getSubscriptionByUser(user.id);
  expect(subscription.status).toBe('paused');
});

test('dispute webhook freezes an existing subscription', async () => {
  const email = 'dispute@example.com';
  await request(app)
    .post('/api/webhook/dodo')
    .set('webhook-id', 'evt_dispute_activate')
    .send(paymentSucceeded('evt_dispute_activate', email))
    .expect(200);

  await request(app)
    .post('/api/webhook/dodo')
    .set('webhook-id', 'evt_dispute_freeze')
    .send({
      id: 'evt_dispute_freeze',
      type: 'dispute.opened',
      data: { id: 'dispute_001', customer: { email }, metadata: { email } }
    })
    .expect(200);

  const user = db.getOrCreateUser(email, 'Dispute User');
  const subscription = db.getSubscriptionByUser(user.id);
  expect(subscription.status).toBe('paused');
});

test('webhook log is accessible', async () => {
  await request(app)
    .post('/api/webhook/dodo')
    .set('webhook-id', 'evt_log_001')
    .send(paymentSucceeded('evt_log_001', 'log@example.com'))
    .expect(200);

  const response = await request(app).get('/api/webhooks/log').expect(200);
  expect(Array.isArray(response.body.log)).toBe(true);
  expect(response.body.log[0].event_id).toBe('evt_log_001');
});
