const router = require('express').Router();
const db = require('../services/db');
const { optionalApiKey } = require('../middleware/auth');

router.get('/log', optionalApiKey, (req, res) => {
  const log = db.getWebhookLog(50).filter((event) => {
    if (!req.developer) return true;
    try {
      const payload = JSON.parse(event.raw_body || '{}');
      const metadata = payload.data?.metadata || {};
      return metadata.developerId === req.developer.id || metadata.developer_id === req.developer.id;
    } catch {
      return false;
    }
  });
  res.json({ log, total: log.length });
});

module.exports = router;
