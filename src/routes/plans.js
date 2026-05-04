const router = require('express').Router();
const db = require('../services/db');

router.get('/', (req, res) => {
  res.json({ plans: db.getPlans() });
});

router.get('/:id', (req, res) => {
  const plan = db.getPlanById(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ plan });
});

module.exports = router;
