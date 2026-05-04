const router = require('express').Router();
const db = require('../services/db');

router.get('/', (req, res) => {
  const subscriptions = db.getAllSubscriptions().map((sub) => ({
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

router.get('/events', (req, res) => {
  res.json({ events: db.getRecentEvents(30) });
});

module.exports = router;
