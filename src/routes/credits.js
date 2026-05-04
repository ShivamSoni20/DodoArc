const router = require('express').Router();
const db = require('../services/db');

router.get('/:userId', (req, res) => {
  const subscription = db.getSubscriptionByUser(req.params.userId);
  if (!subscription) return res.json({ credits_remaining: 0, status: 'no_subscription' });

  res.json({
    credits_total: subscription.credits_total,
    credits_used: subscription.credits_used,
    credits_remaining: subscription.credits_total - subscription.credits_used,
    status: subscription.status,
    planId: subscription.planId
  });
});

router.post('/consume', (req, res) => {
  const { userId, amount = 1, agentName = 'Demo Agent', action = 'agent.run' } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const result = db.deductCredits(userId, numericAmount);
  if (!result.success) return res.status(402).json({ error: result.error });

  db.logEvent('credits_consumed', { userId, amount: numericAmount, agentName, action });
  res.json({ success: true, consumed: numericAmount, remaining: result.remaining });
});

module.exports = router;
