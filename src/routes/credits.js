const router = require('express').Router();
const db = require('../services/db');
const { optionalApiKey, requireApiKey } = require('../middleware/auth');

router.get('/:userId', optionalApiKey, (req, res) => {
  const appId = req.query.appId || null;
  const subscription = db.getSubscriptionByUser(req.params.userId, {
    developerId: req.developer?.id || null,
    appId
  });
  if (!subscription) return res.json({ credits_remaining: 0, status: 'no_subscription' });

  res.json({
    credits_total: subscription.credits_total,
    credits_used: subscription.credits_used,
    credits_remaining: subscription.credits_total - subscription.credits_used,
    status: subscription.status,
    planId: subscription.planId
  });
});

router.post('/consume', requireApiKey, (req, res) => {
  const { userId, amount = 1, agentName = 'Demo Agent', action = 'agent.run', appId = null } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  if (appId) {
    const app = db.getAppById(appId);
    if (!app || app.developerId !== req.developer.id) {
      return res.status(404).json({ error: 'App not found' });
    }
  }

  const scopedSubscription = db.getSubscriptionByUser(userId, {
    developerId: req.developer.id,
    appId
  });
  if (!scopedSubscription) {
    return res.status(404).json({ error: 'No active subscription for this developer or app' });
  }

  const result = db.deductCredits(userId, numericAmount, {
    developerId: req.developer.id,
    appId: scopedSubscription.appId || appId || null
  });
  if (!result.success) return res.status(402).json({ error: result.error });

  db.logEvent(
    'credits_consumed',
    {
      userId,
      developerId: req.developer.id,
      appId: scopedSubscription.appId || appId || null,
      amount: numericAmount,
      agentName,
      action
    },
    {
      developerId: req.developer.id,
      appId: scopedSubscription.appId || appId || null
    }
  );
  res.json({ success: true, consumed: numericAmount, remaining: result.remaining });
});

module.exports = router;
