const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

async function registerDeveloper(email = 'platform@dodoarc.xyz') {
  const response = await request(app)
    .post('/api/developer/register')
    .send({ email, name: 'Platform Dev' })
    .expect(201);
  return response.body;
}

test('developer registration returns an API key once', async () => {
  const body = await registerDeveloper();

  expect(body.success).toBe(true);
  expect(body.developer.id).toMatch(/^dev_/);
  expect(body.apiKey.key).toMatch(/^da_live_/);
  expect(body.apiKey.prefix).toBe(body.apiKey.key.slice(0, 12));
});

test('duplicate developer registration is rejected', async () => {
  await registerDeveloper('duplicate@dodoarc.xyz');

  await request(app)
    .post('/api/developer/register')
    .send({ email: 'duplicate@dodoarc.xyz', name: 'Again' })
    .expect(409);
});

test('developer profile requires API key and returns key prefixes only', async () => {
  const body = await registerDeveloper('profile@dodoarc.xyz');

  const profile = await request(app)
    .get('/api/developer/me')
    .set('x-api-key', body.apiKey.key)
    .expect(200);

  expect(profile.body.developer.email).toBe('profile@dodoarc.xyz');
  expect(profile.body.keys[0].keyPrefix).toBe(body.apiKey.prefix);
  expect(JSON.stringify(profile.body.keys)).not.toContain(body.apiKey.key);
});

test('developer can create app and receive embed code', async () => {
  const body = await registerDeveloper('apps@dodoarc.xyz');

  const appResponse = await request(app)
    .post('/api/developer/apps')
    .set('x-api-key', body.apiKey.key)
    .send({ name: 'Signal Agent', description: 'Solana trading signals', planId: 'plan_pro' })
    .expect(201);

  expect(appResponse.body.app.id).toMatch(/^app_/);
  expect(appResponse.body.embed).toContain('/embed/dodoarc.js');
  expect(appResponse.body.checkoutUrl).toContain(appResponse.body.app.id);
});

test('developer can connect founder-owned Dodo billing to an app', async () => {
  const body = await registerDeveloper('billing@dodoarc.xyz');
  const appResponse = await request(app)
    .post('/api/developer/apps')
    .set('x-api-key', body.apiKey.key)
    .send({ name: 'Signal Agent', description: 'Solana trading signals', planId: 'plan_pro' })
    .expect(201);

  const billingResponse = await request(app)
    .put(`/api/developer/apps/${appResponse.body.app.id}/billing`)
    .set('x-api-key', body.apiKey.key)
    .send({
      dodo_api_key: 'dodo_test_founder_key',
      dodo_product_id: 'prod_founder_signal',
      dodo_webhook_secret: 'whsec_founder_signal'
    })
    .expect(200);

  expect(billingResponse.body.success).toBe(true);
  expect(billingResponse.body.app.billingConnected).toBe(true);
  expect(billingResponse.body.billing.hasApiKey).toBe(true);
  expect(billingResponse.body.billing.dodoProductId).toBe('prod_founder_signal');
});

test('developer can update app product mapping', async () => {
  const body = await registerDeveloper('mapping@dodoarc.xyz');
  const appResponse = await request(app)
    .post('/api/developer/apps')
    .set('x-api-key', body.apiKey.key)
    .send({ name: 'Signal Agent', description: 'Solana trading signals', planId: 'plan_pro', creditsPerRun: 10 })
    .expect(201);

  const configResponse = await request(app)
    .put(`/api/developer/apps/${appResponse.body.app.id}/config`)
    .set('x-api-key', body.apiKey.key)
    .send({ planId: 'plan_starter', creditsPerRun: 7 })
    .expect(200);

  expect(configResponse.body.success).toBe(true);
  expect(configResponse.body.app.planId).toBe('plan_starter');
  expect(configResponse.body.app.creditsPerRun).toBe(7);
});

test('paid checkout is blocked when app billing is not connected', async () => {
  const body = await registerDeveloper('merchant-gap@dodoarc.xyz');
  const appResponse = await request(app)
    .post('/api/developer/apps')
    .set('x-api-key', body.apiKey.key)
    .send({ name: 'Signal Agent', description: 'Solana trading signals', planId: 'plan_pro' })
    .expect(201);

  const checkoutResponse = await request(app)
    .post('/api/checkout/create')
    .send({
      planId: 'plan_pro',
      email: 'buyer@example.com',
      name: 'Buyer',
      appId: appResponse.body.app.id
    })
    .expect(409);

  expect(checkoutResponse.body.code).toBe('APP_BILLING_NOT_CONNECTED');
});

test('MCP discovery endpoint lists DodoArc tools', async () => {
  const response = await request(app).get('/.well-known/mcp').expect(200);

  expect(response.body.name).toBe('DodoArc');
  expect(response.body.tools).toContain('check_credits');
  expect(response.body.tools).toContain('run_agent');
});
