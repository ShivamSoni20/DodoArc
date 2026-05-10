require('dotenv').config();

const BASE_URL = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const checks = [];
  async function check(name, fn) {
    try {
      await fn();
      checks.push({ name, ok: true });
      console.log(`OK   ${name}`);
    } catch (error) {
      checks.push({ name, ok: false, error: error.message });
      console.log(`FAIL ${name}: ${error.message}`);
    }
  }

  let apiKey = '';
  let userId = '';
  let demoApiKey = '';
  let demoAppId = '';

  await check('health endpoint', async () => {
    const { response, body } = await request('/api/health');
    assert(response.ok, 'health did not return 200');
    assert(body.status === 'ok', 'health status is not ok');
  });

  await check('landing page loads', async () => {
    const { response, body } = await request('/');
    assert(response.ok, 'landing did not return 200');
    assert(String(body).includes('DodoArc'), 'landing does not include DodoArc');
  });

  await check('dashboard loads', async () => {
    const { response, body } = await request('/dashboard');
    assert(response.ok, 'dashboard did not return 200');
    assert(String(body).includes('db-main-content'), 'dashboard shell missing');
  });

  await check('plans endpoint', async () => {
    const { response, body } = await request('/api/plans');
    assert(response.ok, 'plans did not return 200');
    assert(Array.isArray(body.plans), 'plans array missing');
  });

  await check('developer registration', async () => {
    const email = `smoke-${Date.now()}@dodoarc.xyz`;
    const { response, body } = await request('/api/developer/register', {
      method: 'POST',
      body: JSON.stringify({ email, name: 'Smoke Dev' })
    });
    assert(response.status === 201, 'developer registration failed');
    assert(body.apiKey?.key?.startsWith('da_live_'), 'api key missing');
    apiKey = body.apiKey.key;
  });

  await check('developer app creation', async () => {
    const { response, body } = await request('/api/developer/apps', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: JSON.stringify({ name: 'Smoke Agent', description: 'Smoke test app', planId: 'plan_pro' })
    });
    assert(response.status === 201, 'app creation failed');
    assert(body.embed.includes('/embed/dodoarc.js'), 'embed script missing');
  });

  await check('demo user setup', async () => {
    const { response, body } = await request('/api/demo/user');
    assert(response.ok, 'demo user failed');
    userId = body.user.id;
    demoAppId = body.app.id;
    assert(body.subscription.credits_total > 0, 'demo credits missing');
  });

  await check('demo developer key', async () => {
    const { response, body } = await request('/api/demo/developer-key', { method: 'POST' });
    assert(response.status === 201, 'demo developer key failed');
    demoApiKey = body.apiKey.key;
    if (!demoAppId) demoAppId = body.app.id;
  });

  await check('simulate payment', async () => {
    const { response, body } = await request('/api/demo/simulate-payment', { method: 'POST' });
    assert(response.ok, 'simulate payment failed');
    assert(body.success, 'simulate payment success missing');
  });

  await check('agent run with API key', async () => {
    const { response, body } = await request('/api/agent/run', {
      method: 'POST',
      headers: { 'x-api-key': demoApiKey },
      body: JSON.stringify({ userId, appId: demoAppId })
    });
    assert(response.ok, 'agent run failed');
    assert(body.result.receipts.length === 3, 'expected 3 receipts');
  });

  await check('settlement log', async () => {
    const { response, body } = await request('/api/solana/settlement-log', {
      headers: { 'x-api-key': demoApiKey }
    });
    assert(response.ok, 'settlement log failed');
    assert(body.receipts.length >= 3, 'settlement receipts missing');
  });

  await check('dashboard metrics', async () => {
    const { response, body } = await request('/api/dashboard/metrics');
    assert(response.ok, 'metrics failed');
    assert(Array.isArray(body.monthlyRevenue), 'monthlyRevenue missing');
  });

  await check('MCP discovery', async () => {
    const { response, body } = await request('/.well-known/mcp');
    assert(response.ok, 'MCP discovery failed');
    assert(body.tools.includes('run_agent'), 'run_agent tool missing');
  });

  const failed = checks.filter((item) => !item.ok);
  if (failed.length) {
    console.log(`\nSmoke failed: ${failed.length}/${checks.length}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nSmoke passed: ${checks.length}/${checks.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
