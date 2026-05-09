const router = require('express').Router();
const db = require('../services/db');

const DEMO_EMAIL = 'demo@dodoarc.xyz';
const DEMO_DEV_EMAIL = 'demo-dev@dodoarc.xyz';

function getOrCreateDemoUser() {
  const user = db.getOrCreateUser(DEMO_EMAIL, 'Demo User');
  const plan = db.getPlanById('plan_pro');
  let subscription = db.getSubscriptionByUser(user.id);

  if (!subscription) {
    subscription = db.createSubscription({
      userId: user.id,
      planId: plan.id,
      status: 'active',
      credits_total: plan.credits,
      credits_used: 0,
      payment_method: 'demo'
    });
  }

  if (subscription.credits_total - subscription.credits_used < 20) {
    subscription = db.updateSubscription(subscription.id, {
      status: 'active',
      credits_total: subscription.credits_total + plan.credits
    });
  }

  return { user, subscription: db.getSubscriptionByUser(user.id), plan };
}

router.get('/user', (req, res) => {
  const { user, subscription } = getOrCreateDemoUser();
  res.json({ user, sub: subscription, subscription });
});

router.post('/simulate-payment', (req, res) => {
  const { user, subscription, plan } = getOrCreateDemoUser();
  const updated = db.updateSubscription(subscription.id, {
    status: 'active',
    credits_total: subscription.credits_total + plan.credits,
    payment_method: 'demo',
    last_payment_amount: plan.price * 100,
    last_payment_currency: 'INR'
  });

  db.logEvent('credits_topped_up', {
    userId: user.id,
    email: user.email,
    planId: plan.id,
    credits: plan.credits,
    amount: plan.price * 100,
    currency: 'INR',
    method: 'demo'
  });

  req.app.locals.broadcast?.('subscription_update', {
    type: 'payment.succeeded',
    email: user.email,
    planId: plan.id,
    action: 'demo_payment_simulated'
  });

  res.json({ success: true, user, subscription: updated, planId: plan.id });
});

router.post('/developer-key', (req, res) => {
  let developer = db.getDeveloperByEmail(DEMO_DEV_EMAIL);
  if (!developer) developer = db.createDeveloper(DEMO_DEV_EMAIL, 'Demo Developer');
  const apiKey = db.generateApiKey(developer.id, 'Demo Dashboard Key');
  res.status(201).json({
    success: true,
    developer,
    apiKey: {
      key: apiKey.key,
      prefix: apiKey.prefix,
      warning: 'Demo key generated for this browser session.'
    }
  });
});

module.exports = router;
