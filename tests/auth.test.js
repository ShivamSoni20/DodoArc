const request = require('supertest');
const app = require('../server');
const db = require('../src/services/db');

beforeEach(() => db.resetForTests());

test('unauthenticated founder dashboard redirects to login', async () => {
  const response = await request(app).get('/dashboard').expect(302);
  expect(response.headers.location).toContain('/login?role=founder');
});

test('unauthenticated user app redirects to login', async () => {
  const response = await request(app).get('/app').expect(302);
  expect(response.headers.location).toContain('/login?role=user');
});

test('user signup creates a session and opens the user app', async () => {
  const agent = request.agent(app);
  const signup = await agent
    .post('/api/auth/signup')
    .send({
      role: 'user',
      name: 'User One',
      email: 'user-one@dodoarc.xyz',
      password: 'password123'
    })
    .expect(201);

  expect(signup.body.account.role).toBe('user');
  expect(signup.body.redirectTo).toBe('/app');

  const me = await agent.get('/api/auth/me').expect(200);
  expect(me.body.account.email).toBe('user-one@dodoarc.xyz');

  await agent.get('/app').expect(200);
});

test('founder signup creates a session, API key, and opens the dashboard', async () => {
  const agent = request.agent(app);
  const signup = await agent
    .post('/api/auth/signup')
    .send({
      role: 'founder',
      name: 'Founder One',
      email: 'founder-one@dodoarc.xyz',
      password: 'password123'
    })
    .expect(201);

  expect(signup.body.account.role).toBe('founder');
  expect(signup.body.redirectTo).toBe('/dashboard');
  expect(signup.body.apiKey).toMatch(/^da_live_/);

  const me = await agent.get('/api/auth/me').expect(200);
  expect(me.body.account.email).toBe('founder-one@dodoarc.xyz');
  expect(me.body.apiKey).toMatch(/^da_live_/);

  await agent.get('/dashboard').expect(200);
});
