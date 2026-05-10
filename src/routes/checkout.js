const router = require('express').Router();
const db = require('../services/db');
const dodo = require('../services/dodo');

router.post('/create', async (req, res) => {
  try {
    const { planId, email, name, appId } = req.body;
    if (!planId || !email) {
      return res.status(400).json({ error: 'planId and email are required' });
    }

    const app = appId ? db.getAppById(appId) : null;
    if (appId && !app) {
      return res.status(404).json({ error: 'App not found' });
    }
    const effectivePlanId = app?.planId || planId;
    const plan = db.getPlanById(effectivePlanId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const user = db.getOrCreateUser(email, name);

    if (plan.price === 0) {
      const subscription = db.upsertSubscription({
        userId: user.id,
        planId: plan.id,
        status: 'active',
        credits_total: plan.credits,
        credits_used: 0,
        payment_method: 'free',
        developer_id: app?.developerId || null,
        app_id: app?.id || null
      });
      if (app?.id && app?.developerId) {
        db.registerAppUser(app.id, app.developerId, user.id);
        db.ensureAppPolicy(app.id, app.developerId);
      }
      db.logEvent('subscription_activated', {
        userId: user.id,
        email: user.email,
        planId: plan.id,
        method: 'free',
        developerId: app?.developerId || null,
        appId: app?.id || null
      }, {
        developerId: app?.developerId || null,
        appId: app?.id || null
      });
      return res.json({ success: true, type: 'free', user, subscription });
    }

    const session = await dodo.createCheckoutSession({
      plan,
      user,
      metadata: {
        app: 'dodoarc',
        planId: plan.id,
        ...(app?.id ? { appId: app.id } : {}),
        ...(app?.developerId ? { developerId: app.developerId } : {}),
        userId: user.id,
        email: user.email,
        name: user.name
      }
    });

    db.logEvent('checkout_initiated', {
      userId: user.id,
      email: user.email,
      planId: plan.id,
      appId: app?.id || null,
      developerId: app?.developerId || null,
      checkoutMode: session.mode
    }, {
      developerId: app?.developerId || null,
      appId: app?.id || null
    });

    res.json({
      success: true,
      type: 'paid',
      checkout_mode: session.mode,
      checkout_session_id: session.checkout_session_id,
      payment_url: session.checkout_url
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout' });
  }
});

module.exports = router;
