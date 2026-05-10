const router = require('express').Router();
const db = require('../services/db');
const { optionalApiKey } = require('../middleware/auth');

router.get('/', optionalApiKey, (req, res) => {
  const base = req.developer
    ? db.getSubscriptionsByDeveloper(req.developer.id)
    : db.getAllSubscriptions();

  const subscriptions = base.map((sub) => ({
    ...sub,
    user: db.getUserById(sub.userId),
    plan: db.getPlanById(sub.planId),
    credits_remaining: sub.credits_total - sub.credits_used
  }));

  res.json({
    subscriptions,
    total: subscriptions.length,
    active: subscriptions.filter((sub) => sub.status === 'active').length
  });
});

router.get('/events', optionalApiKey, (req, res) => {
  const events = req.developer
    ? db.getRecentEventsByDeveloper(req.developer.id, 30)
    : db.getRecentEvents(30);
  res.json({ events });
});

module.exports = router;
