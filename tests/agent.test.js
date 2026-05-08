const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

function createCreditedUser(email = 'agenttest@dodoarc.xyz') {
  const user = db.getOrCreateUser(email, 'Agent Test');
  db.createSubscription({
    userId: user.id,
    planId: 'plan_pro',
    status: 'active',
    credits_total: 100,
    credits_used: 0,
    payment_method: 'test'
  });
  return user;
}

test('POST /api/agent/run returns signal and three x402 receipts', async () => {
  const user = createCreditedUser();

  const response = await request(app)
    .post('/api/agent/run')
    .send({ userId: user.id })
    .expect(200);

  expect(response.body.success).toBe(true);
  expect(response.body.creditsUsed).toBe(10);
  expect(['BUY', 'HOLD', 'SELL']).toContain(response.body.result.signal);
  expect(response.body.result.receipts).toHaveLength(3);
});

test('agent run deducts 10 credits', async () => {
  const user = createCreditedUser('deduct@dodoarc.xyz');
  const before = db.getRemainingCredits(user.id);

  await request(app).post('/api/agent/run').send({ userId: user.id }).expect(200);

  expect(before - db.getRemainingCredits(user.id)).toBe(10);
});

test('agent run stores settlement receipts', async () => {
  const user = createCreditedUser('settlement@dodoarc.xyz');

  await request(app).post('/api/agent/run').send({ userId: user.id }).expect(200);

  const settlements = db.getRecentSettlements();
  expect(settlements.length).toBe(3);
  expect(settlements[0].tx_signature).toBeTruthy();
  expect(settlements[0].amount_usdc).toBeGreaterThan(0);
});

test('GET /api/agent/runs returns run history', async () => {
  const user = createCreditedUser('runs@dodoarc.xyz');
  await request(app).post('/api/agent/run').send({ userId: user.id }).expect(200);

  const response = await request(app).get('/api/agent/runs').expect(200);

  expect(Array.isArray(response.body.runs)).toBe(true);
  expect(response.body.runs[0].status).toBe('completed');
});

test('GET /api/solana/settlement-log returns receipts and total', async () => {
  const user = createCreditedUser('log@dodoarc.xyz');
  await request(app).post('/api/agent/run').send({ userId: user.id }).expect(200);

  const response = await request(app).get('/api/solana/settlement-log').expect(200);

  expect(Array.isArray(response.body.receipts)).toBe(true);
  expect(response.body.receipts.length).toBe(3);
  expect(response.body.totalSettled).toBeGreaterThan(0);
});

test('agent run fails with 402 when user has no credits', async () => {
  const user = db.getOrCreateUser('broke@dodoarc.xyz', 'Broke User');

  const response = await request(app)
    .post('/api/agent/run')
    .send({ userId: user.id })
    .expect(402);

  expect(response.body.error).toMatch(/credits/i);
});

test('POST /api/agent/run returns 400 without userId', async () => {
  await request(app).post('/api/agent/run').send({}).expect(400);
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
