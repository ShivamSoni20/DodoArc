const crypto = require('crypto');
const sqlite = require('./sqlite');

const PLANS = [
  {
    id: 'plan_starter',
    name: 'Starter',
    price: 0,
    display_price: 'Free',
    currency: 'INR',
    credits: 100,
    interval: 'monthly',
    dodo_product_id: process.env.DODO_STARTER_PRODUCT_ID || null
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    price: 499,
    display_price: 'INR 499/mo',
    currency: 'INR',
    credits: 1000,
    interval: 'monthly',
    dodo_product_id: process.env.DODO_PRO_PRODUCT_ID || null
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    price: null,
    display_price: 'Custom',
    currency: 'INR',
    credits: 0,
    interval: 'custom',
    dodo_product_id: null
  }
];

const stmts = {
  insertWebhookLog: sqlite.prepare(`
    INSERT OR IGNORE INTO webhook_log (event_id, event_type, raw_body, status)
    VALUES (@event_id, @event_type, @raw_body, 'pending')
  `),
  isWebhookProcessed: sqlite.prepare(`
    SELECT event_id, status FROM webhook_log WHERE event_id = ? AND status = 'processed'
  `),
  markWebhookProcessed: sqlite.prepare(`
    UPDATE webhook_log
    SET status = 'processed',
        action_taken = @action_taken,
        error_message = NULL,
        processed_at = CURRENT_TIMESTAMP
    WHERE event_id = @event_id
  `),
  markWebhookFailed: sqlite.prepare(`
    UPDATE webhook_log
    SET status = 'failed',
        error_message = @error_message,
        retry_count = retry_count + 1
    WHERE event_id = @event_id
  `),
  getWebhookLog: sqlite.prepare(`
    SELECT * FROM webhook_log ORDER BY received_at DESC, id DESC LIMIT ?
  `),

  getUserByEmail: sqlite.prepare('SELECT * FROM users WHERE email = ?'),
  getUserById: sqlite.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: sqlite.prepare(`
    INSERT INTO users (id, email, name, dodo_customer_id)
    VALUES (@id, @email, @name, @dodo_customer_id)
  `),
  updateUser: sqlite.prepare(`
    UPDATE users
    SET name = COALESCE(@name, name),
        dodo_customer_id = COALESCE(@dodo_customer_id, dodo_customer_id)
    WHERE id = @id
  `),

  insertDeveloper: sqlite.prepare(`
    INSERT OR IGNORE INTO developers (id, email, name)
    VALUES (@id, @email, @name)
  `),
  getDeveloperByEmail: sqlite.prepare('SELECT * FROM developers WHERE email = ?'),
  getDeveloperById: sqlite.prepare('SELECT * FROM developers WHERE id = ?'),
  insertApiKey: sqlite.prepare(`
    INSERT INTO api_keys (key_hash, key_prefix, developer_id, name)
    VALUES (@key_hash, @key_prefix, @developer_id, @name)
  `),
  getApiKeyByHash: sqlite.prepare(`
    SELECT ak.*, d.email AS developer_email, d.name AS developer_name
    FROM api_keys ak
    JOIN developers d ON d.id = ak.developer_id
    WHERE ak.key_hash = ?
  `),
  updateApiKeyLastUsed: sqlite.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = ?'),
  getApiKeysByDeveloper: sqlite.prepare(`
    SELECT id, key_prefix, name, created_at, last_used_at
    FROM api_keys WHERE developer_id = ?
    ORDER BY created_at DESC, id DESC
  `),
  insertApp: sqlite.prepare(`
    INSERT INTO developer_apps (id, developer_id, name, description, plan_id, credits_per_run)
    VALUES (@id, @developer_id, @name, @description, @plan_id, @credits_per_run)
  `),
  getAppsByDeveloper: sqlite.prepare('SELECT * FROM developer_apps WHERE developer_id = ? ORDER BY created_at DESC'),
  getAppById: sqlite.prepare('SELECT * FROM developer_apps WHERE id = ?'),

  getSubByUser: sqlite.prepare(`
    SELECT * FROM subscriptions WHERE user_id = ? AND status != 'cancelled'
    ORDER BY created_at DESC LIMIT 1
  `),
  getSubByUserAndPlan: sqlite.prepare(`
    SELECT * FROM subscriptions WHERE user_id = ? AND plan_id = ? AND status != 'cancelled'
    ORDER BY created_at DESC LIMIT 1
  `),
  getSubById: sqlite.prepare('SELECT * FROM subscriptions WHERE id = ?'),
  insertSub: sqlite.prepare(`
    INSERT INTO subscriptions (
      id, user_id, plan_id, dodo_payment_id, dodo_subscription_id, status,
      credits_total, credits_used, payment_method, last_payment_amount, last_payment_currency
    )
    VALUES (
      @id, @user_id, @plan_id, @dodo_payment_id, @dodo_subscription_id, @status,
      @credits_total, @credits_used, @payment_method, @last_payment_amount, @last_payment_currency
    )
  `),
  updateSub: sqlite.prepare(`
    UPDATE subscriptions
    SET status = COALESCE(@status, status),
        credits_total = COALESCE(@credits_total, credits_total),
        credits_used = COALESCE(@credits_used, credits_used),
        dodo_payment_id = COALESCE(@dodo_payment_id, dodo_payment_id),
        dodo_subscription_id = COALESCE(@dodo_subscription_id, dodo_subscription_id),
        payment_method = COALESCE(@payment_method, payment_method),
        last_payment_amount = COALESCE(@last_payment_amount, last_payment_amount),
        last_payment_currency = COALESCE(@last_payment_currency, last_payment_currency),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),
  deductCredits: sqlite.prepare(`
    UPDATE subscriptions
    SET credits_used = credits_used + @amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = @user_id
      AND status = 'active'
      AND (credits_total - credits_used) >= @amount
  `),
  getAllSubs: sqlite.prepare(`
    SELECT * FROM subscriptions ORDER BY created_at DESC
  `),

  insertEvent: sqlite.prepare('INSERT INTO events (type, data) VALUES (@type, @data)'),
  getRecentEvents: sqlite.prepare('SELECT * FROM events ORDER BY timestamp DESC, id DESC LIMIT ?'),
  insertSettlement: sqlite.prepare(`
    INSERT INTO settlement_receipts (
      agent_run_id, tool_name, amount_usdc, to_wallet, tx_signature, explorer_url, mock
    )
    VALUES (
      @agent_run_id, @tool_name, @amount_usdc, @to_wallet, @tx_signature, @explorer_url, @mock
    )
  `),
  getRecentSettlements: sqlite.prepare(`
    SELECT * FROM settlement_receipts ORDER BY created_at DESC, id DESC LIMIT ?
  `),
  insertAgentRun: sqlite.prepare(`
    INSERT OR IGNORE INTO agent_runs (run_id, user_id, agent_name, credits_used, status)
    VALUES (@run_id, @user_id, @agent_name, @credits_used, @status)
  `),
  completeAgentRun: sqlite.prepare(`
    UPDATE agent_runs
    SET status = @status,
        result = @result,
        completed_at = CURRENT_TIMESTAMP
    WHERE run_id = @run_id
  `),
  getRecentRuns: sqlite.prepare(`
    SELECT * FROM agent_runs ORDER BY created_at DESC, id DESC LIMIT ?
  `),
  resetWebhookLog: sqlite.prepare('DELETE FROM webhook_log'),
  resetUsers: sqlite.prepare('DELETE FROM users'),
  resetSubscriptions: sqlite.prepare('DELETE FROM subscriptions'),
  resetEvents: sqlite.prepare('DELETE FROM events'),
  resetSettlements: sqlite.prepare('DELETE FROM settlement_receipts'),
  resetAgentRuns: sqlite.prepare('DELETE FROM agent_runs'),
  resetApps: sqlite.prepare('DELETE FROM developer_apps'),
  resetApiKeys: sqlite.prepare('DELETE FROM api_keys'),
  resetDevelopers: sqlite.prepare('DELETE FROM developers')
};

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    dodo_customer_id: row.dodo_customer_id,
    created_at: row.created_at
  };
}

function normalizeSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    dodo_payment_id: row.dodo_payment_id,
    dodo_subscription_id: row.dodo_subscription_id,
    status: row.status,
    credits_total: row.credits_total,
    credits_used: row.credits_used,
    payment_method: row.payment_method,
    last_payment_amount: row.last_payment_amount,
    last_payment_currency: row.last_payment_currency,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeEvent(row) {
  return {
    id: `evt_${row.id}`,
    type: row.type,
    data: row.data ? JSON.parse(row.data) : {},
    timestamp: row.timestamp
  };
}

function normalizeAgentRun(row) {
  if (!row) return null;
  return {
    ...row,
    result: row.result ? JSON.parse(row.result) : null
  };
}

function normalizeDeveloper(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    created_at: row.created_at
  };
}

function normalizeApp(row) {
  if (!row) return null;
  return {
    id: row.id,
    developerId: row.developer_id,
    name: row.name,
    description: row.description,
    planId: row.plan_id,
    creditsPerRun: row.credits_per_run,
    created_at: row.created_at
  };
}

function normalizeApiKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    keyPrefix: row.key_prefix,
    name: row.name,
    created_at: row.created_at,
    last_used_at: row.last_used_at
  };
}

function getOrCreateUser(email, name = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  let user = stmts.getUserByEmail.get(normalizedEmail);
  if (user) {
    if (name && user.name !== name) stmts.updateUser.run({ id: user.id, name, dodo_customer_id: null });
    return normalizeUser(stmts.getUserByEmail.get(normalizedEmail));
  }

  const created = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: normalizedEmail,
    name: name || normalizedEmail.split('@')[0],
    dodo_customer_id: null
  };
  stmts.insertUser.run(created);
  logEvent('user_created', { userId: created.id, email: created.email });
  return normalizeUser(stmts.getUserById.get(created.id));
}

function upsertSubscription(data) {
  const existing = stmts.getSubByUserAndPlan.get(data.userId, data.planId);
  const payload = {
    id: existing?.id || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: data.userId,
    plan_id: data.planId,
    dodo_payment_id: data.dodo_payment_id || null,
    dodo_subscription_id: data.dodo_subscription_id || null,
    status: data.status || 'active',
    credits_total: data.credits_total || 0,
    credits_used: data.credits_used || 0,
    payment_method: data.payment_method || null,
    last_payment_amount: data.last_payment_amount || null,
    last_payment_currency: data.last_payment_currency || null
  };

  if (existing) {
    stmts.updateSub.run(payload);
    return normalizeSubscription(stmts.getSubById.get(existing.id));
  }

  stmts.insertSub.run(payload);
  return normalizeSubscription(stmts.getSubById.get(payload.id));
}

function updateSubscription(id, updates) {
  const current = stmts.getSubById.get(id);
  if (!current) return null;

  stmts.updateSub.run({
    id,
    status: updates.status ?? null,
    credits_total: updates.credits_total ?? null,
    credits_used: updates.credits_used ?? null,
    dodo_payment_id: updates.dodo_payment_id ?? null,
    dodo_subscription_id: updates.dodo_subscription_id ?? null,
    payment_method: updates.payment_method ?? null,
    last_payment_amount: updates.last_payment_amount ?? null,
    last_payment_currency: updates.last_payment_currency ?? null
  });

  return normalizeSubscription(stmts.getSubById.get(id));
}

function logEvent(type, data = {}) {
  const info = stmts.insertEvent.run({ type, data: JSON.stringify(data) });
  return normalizeEvent({ id: info.lastInsertRowid, type, data: JSON.stringify(data), timestamp: new Date().toISOString() });
}

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function createDeveloper(email, name = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const developer = {
    id: `dev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: normalizedEmail,
    name: name || normalizedEmail.split('@')[0]
  };
  stmts.insertDeveloper.run(developer);
  return normalizeDeveloper(stmts.getDeveloperByEmail.get(normalizedEmail));
}

function generateApiKey(developerId, keyName = 'Default') {
  const rawKey = `da_live_${crypto.randomBytes(24).toString('base64url')}`;
  const keyPrefix = rawKey.slice(0, 12);
  stmts.insertApiKey.run({
    key_hash: hashApiKey(rawKey),
    key_prefix: keyPrefix,
    developer_id: developerId,
    name: keyName
  });
  return { key: rawKey, prefix: keyPrefix };
}

function validateApiKey(rawKey) {
  const keyHash = hashApiKey(String(rawKey || '').trim());
  const record = stmts.getApiKeyByHash.get(keyHash);
  if (!record) return null;
  stmts.updateApiKeyLastUsed.run(keyHash);
  return {
    ...record,
    developer: normalizeDeveloper({
      id: record.developer_id,
      email: record.developer_email,
      name: record.developer_name,
      created_at: record.created_at
    })
  };
}

function createApp(developerId, { name, description = '', planId = 'plan_pro', creditsPerRun = 10 }) {
  const app = {
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    developer_id: developerId,
    name,
    description,
    plan_id: planId,
    credits_per_run: Number(creditsPerRun) || 10
  };
  stmts.insertApp.run(app);
  return normalizeApp(stmts.getAppById.get(app.id));
}

module.exports = {
  getPlans: () => PLANS,
  getPlanById: (id) => PLANS.find((plan) => plan.id === id),
  getUsers: () => sqlite.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(normalizeUser),
  getUserById: (id) => normalizeUser(stmts.getUserById.get(id)),
  getOrCreateUser,
  updateUser: (id, updates) => {
    stmts.updateUser.run({
      id,
      name: updates.name ?? null,
      dodo_customer_id: updates.dodo_customer_id ?? null
    });
    return normalizeUser(stmts.getUserById.get(id));
  },

  createDeveloper,
  getDeveloperByEmail: (email) => normalizeDeveloper(stmts.getDeveloperByEmail.get(String(email || '').trim().toLowerCase())),
  getDeveloperById: (id) => normalizeDeveloper(stmts.getDeveloperById.get(id)),
  generateApiKey,
  validateApiKey,
  getApiKeysByDeveloper: (developerId) => stmts.getApiKeysByDeveloper.all(developerId).map(normalizeApiKey),
  createApp,
  getAppsByDeveloper: (developerId) => stmts.getAppsByDeveloper.all(developerId).map(normalizeApp),
  getAppById: (id) => normalizeApp(stmts.getAppById.get(id)),

  upsertSubscription,
  createSubscription: upsertSubscription,
  getAllSubscriptions: () => stmts.getAllSubs.all().map(normalizeSubscription),
  getSubscriptionByUser: (userId) => normalizeSubscription(stmts.getSubByUser.get(userId)),
  updateSubscription,
  deductCredits: (userId, amount) => {
    const sub = normalizeSubscription(stmts.getSubByUser.get(userId));
    if (!sub || sub.status !== 'active') return { success: false, error: 'No active subscription' };
    if (sub.credits_total - sub.credits_used < amount) {
      return { success: false, error: 'Insufficient credits' };
    }

    stmts.deductCredits.run({ user_id: userId, amount });
    return { success: true, remaining: sub.credits_total - sub.credits_used - amount };
  },
  getRemainingCredits: (userId) => {
    const sub = normalizeSubscription(stmts.getSubByUser.get(userId));
    return sub ? sub.credits_total - sub.credits_used : 0;
  },

  logEvent,
  getRecentEvents: (limit = 30) => stmts.getRecentEvents.all(limit).map(normalizeEvent),

  logSettlement: (data) =>
    stmts.insertSettlement.run({
      agent_run_id: data.agent_run_id,
      tool_name: data.tool_name,
      amount_usdc: data.amount_usdc,
      to_wallet: data.to_wallet,
      tx_signature: data.tx_signature,
      explorer_url: data.explorer_url,
      mock: data.mock ? 1 : 0
    }),
  getRecentSettlements: (limit = 20) => stmts.getRecentSettlements.all(limit),
  logAgentRun: (data) =>
    stmts.insertAgentRun.run({
      run_id: data.run_id,
      user_id: data.user_id,
      agent_name: data.agent_name,
      credits_used: data.credits_used,
      status: data.status || 'running'
    }),
  completeAgentRun: (runId, status, result) =>
    stmts.completeAgentRun.run({
      run_id: runId,
      status,
      result: JSON.stringify(result || {})
    }),
  getRecentRuns: (limit = 20) => stmts.getRecentRuns.all(limit).map(normalizeAgentRun),

  logWebhookReceived: (eventId, eventType, rawBody) =>
    stmts.insertWebhookLog.run({
      event_id: eventId,
      event_type: eventType,
      raw_body: typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)
    }).changes > 0,
  isWebhookAlreadyProcessed: (eventId) => Boolean(stmts.isWebhookProcessed.get(eventId)),
  markWebhookProcessed: (eventId, actionTaken) =>
    stmts.markWebhookProcessed.run({ event_id: eventId, action_taken: actionTaken }),
  markWebhookFailed: (eventId, errorMessage) =>
    stmts.markWebhookFailed.run({ event_id: eventId, error_message: errorMessage }),
  getWebhookLog: (limit = 50) => stmts.getWebhookLog.all(limit),
  hasProcessedWebhook: (eventId) => Boolean(stmts.isWebhookProcessed.get(eventId)),

  resetForTests: () => {
    sqlite.transaction(() => {
      stmts.resetWebhookLog.run();
      stmts.resetSubscriptions.run();
      stmts.resetUsers.run();
      stmts.resetApps.run();
      stmts.resetApiKeys.run();
      stmts.resetDevelopers.run();
      stmts.resetEvents.run();
      stmts.resetSettlements.run();
      stmts.resetAgentRuns.run();
    })();
  }
};
