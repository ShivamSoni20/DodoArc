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

test('MCP discovery endpoint lists DodoArc tools', async () => {
  const response = await request(app).get('/.well-known/mcp').expect(200);

  expect(response.body.name).toBe('DodoArc');
  expect(response.body.tools).toContain('check_credits');
  expect(response.body.tools).toContain('run_agent');
});
