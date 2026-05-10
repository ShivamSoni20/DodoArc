const router = require('express').Router();
const db = require('../services/db');

const DEMO_EMAIL = 'demo@dodoarc.xyz';
const DEMO_DEV_EMAIL = 'demo-dev@dodoarc.xyz';
const DEMO_APP_NAME = 'Demo Policy App';

function getOrCreateDemoDeveloperApp() {
  let developer = db.getDeveloperByEmail(DEMO_DEV_EMAIL);
  if (!developer) developer = db.createDeveloper(DEMO_DEV_EMAIL, 'Demo Developer');

  let app = db.getAppsByDeveloper(developer.id)[0];
  if (!app) {
    app = db.createApp(developer.id, {
      name: DEMO_APP_NAME,
      description: 'Demo spend-controlled app',
      planId: 'plan_pro'
    });
  }

  db.ensureAppPolicy(app.id, developer.id);
  return { developer, app };
}

function getOrCreateDemoUser() {
  const { developer, app } = getOrCreateDemoDeveloperApp();
  const user = db.getOrCreateUser(DEMO_EMAIL, 'Demo User');
  const plan = db.getPlanById('plan_pro');
  let subscription = db.getSubscriptionByUser(user.id, {
    developerId: developer.id,
    appId: app.id
  });

  if (!subscription) {
    subscription = db.createSubscription({
      userId: user.id,
      planId: plan.id,
      status: 'active',
      credits_total: plan.credits,
      credits_used: 0,
      payment_method: 'demo',
      developer_id: developer.id,
      app_id: app.id
    });
  }

  db.registerAppUser(app.id, developer.id, user.id);

  if (subscription.credits_total - subscription.credits_used < 20) {
    subscription = db.updateSubscription(subscription.id, {
      status: 'active',
      credits_total: subscription.credits_total + plan.credits,
      developer_id: developer.id,
      app_id: app.id
    });
  }

  return {
    user,
    subscription: db.getSubscriptionByUser(user.id, { developerId: developer.id, appId: app.id }),
    plan,
    developer,
    app
  };
}

router.get('/user', (req, res) => {
  const { user, subscription, app } = getOrCreateDemoUser();
  res.json({ user, sub: subscription, subscription, app });
});

router.post('/simulate-payment', (req, res) => {
  const { user, subscription, plan, developer, app } = getOrCreateDemoUser();
  const updated = db.updateSubscription(subscription.id, {
    status: 'active',
    credits_total: subscription.credits_total + plan.credits,
    payment_method: 'demo',
    last_payment_amount: plan.price * 100,
    last_payment_currency: 'INR',
    developer_id: developer.id,
    app_id: app.id
  });

  db.logEvent('credits_topped_up', {
    userId: user.id,
    email: user.email,
    planId: plan.id,
    credits: plan.credits,
    amount: plan.price * 100,
    currency: 'INR',
    method: 'demo',
    developerId: developer.id,
    appId: app.id
  }, { developerId: developer.id, appId: app.id });

  req.app.locals.broadcast?.('subscription_update', {
    type: 'payment.succeeded',
    email: user.email,
    planId: plan.id,
    action: 'demo_payment_simulated',
    appId: app.id
  });

  res.json({ success: true, user, subscription: updated, planId: plan.id, app });
});

router.post('/developer-key', (req, res) => {
  const { developer, app } = getOrCreateDemoDeveloperApp();
  const apiKey = db.generateApiKey(developer.id, 'Demo Dashboard Key');
  res.status(201).json({
    success: true,
    developer,
    app,
    apiKey: {
      key: apiKey.key,
      prefix: apiKey.prefix,
      warning: 'Demo key generated for this browser session.'
    }
  });
});

module.exports = router;
