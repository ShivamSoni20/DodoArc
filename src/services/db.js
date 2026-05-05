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
    price: 2999,
    display_price: 'INR 2,999/mo',
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
  resetWebhookLog: sqlite.prepare('DELETE FROM webhook_log'),
  resetUsers: sqlite.prepare('DELETE FROM users'),
  resetSubscriptions: sqlite.prepare('DELETE FROM subscriptions'),
  resetEvents: sqlite.prepare('DELETE FROM events')
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
      stmts.resetEvents.run();
    })();
  }
};
