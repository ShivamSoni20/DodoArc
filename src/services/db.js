const now = () => new Date().toISOString();

const store = {
  plans: [
    {
      id: 'plan_starter',
      name: 'Starter',
      price: 0,
      display_price: 'Free',
      currency: 'INR',
      credits: 100,
      interval: 'monthly',
      dodo_product_id: null
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
    }
  ],
  users: [],
  subscriptions: [],
  events: [],
  processedWebhookIds: new Set()
};

function logEvent(type, data = {}) {
  const event = { id: `evt_${Date.now()}_${store.events.length}`, type, data, timestamp: now() };
  store.events.unshift(event);
  if (store.events.length > 100) store.events.pop();
  return event;
}

function getOrCreateUser(email, name = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  let user = store.users.find((candidate) => candidate.email === normalizedEmail);
  if (!user) {
    user = {
      id: `user_${Date.now()}_${store.users.length + 1}`,
      email: normalizedEmail,
      name: name || normalizedEmail.split('@')[0],
      dodo_customer_id: null,
      created_at: now()
    };
    store.users.push(user);
    logEvent('user_created', { userId: user.id, email: user.email });
  }
  return user;
}

function upsertSubscription(data) {
  const existing = store.subscriptions.find(
    (sub) => sub.userId === data.userId && sub.planId === data.planId
  );

  if (existing) {
    Object.assign(existing, data, { updated_at: now() });
    return existing;
  }

  const subscription = {
    id: `sub_${Date.now()}_${store.subscriptions.length + 1}`,
    credits_used: 0,
    status: 'active',
    created_at: now(),
    updated_at: now(),
    ...data
  };
  store.subscriptions.push(subscription);
  return subscription;
}

function resetForTests() {
  store.users.length = 0;
  store.subscriptions.length = 0;
  store.events.length = 0;
  store.processedWebhookIds.clear();
}

module.exports = {
  getPlans: () => store.plans,
  getPlanById: (id) => store.plans.find((plan) => plan.id === id),
  getUsers: () => store.users,
  getUserById: (id) => store.users.find((user) => user.id === id),
  getOrCreateUser,
  updateUser: (id, updates) => {
    const user = store.users.find((candidate) => candidate.id === id);
    if (user) Object.assign(user, updates);
    return user;
  },
  upsertSubscription,
  getAllSubscriptions: () => store.subscriptions,
  getSubscriptionByUser: (userId) =>
    store.subscriptions.find((sub) => sub.userId === userId && sub.status === 'active'),
  updateSubscription: (id, updates) => {
    const sub = store.subscriptions.find((candidate) => candidate.id === id);
    if (sub) Object.assign(sub, updates, { updated_at: now() });
    return sub;
  },
  deductCredits: (userId, amount) => {
    const sub = store.subscriptions.find(
      (candidate) => candidate.userId === userId && candidate.status === 'active'
    );
    if (!sub) return { success: false, error: 'No active subscription' };

    const remaining = sub.credits_total - sub.credits_used;
    if (remaining < amount) return { success: false, error: 'Insufficient credits' };

    sub.credits_used += amount;
    sub.updated_at = now();
    return { success: true, remaining: sub.credits_total - sub.credits_used };
  },
  logEvent,
  getRecentEvents: (limit = 30) => store.events.slice(0, limit),
  markWebhookProcessed: (id) => store.processedWebhookIds.add(id),
  hasProcessedWebhook: (id) => store.processedWebhookIds.has(id),
  resetForTests
};
