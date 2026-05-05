const router = require('express').Router();
const db = require('../services/db');

router.get('/log', (req, res) => {
  const log = db.getWebhookLog(50);
  res.json({ log, total: log.length });
});

module.exports = router;
