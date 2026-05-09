const db = require('../services/db');

function extractApiKey(req) {
  const headerKey = req.headers['x-api-key'];
  const authorization = req.headers.authorization || '';
  if (headerKey) return String(headerKey).trim();
  if (authorization.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim();
  return '';
}

function attachDeveloper(req, record) {
  req.developer = {
    id: record.developer_id,
    email: record.developer_email,
    name: record.developer_name
  };
}

function requireApiKey(req, res, next) {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key',
      hint: 'Add header: x-api-key: da_live_YOUR_KEY',
      docs: '/api/developer/docs'
    });
  }

  const record = db.validateApiKey(apiKey);
  if (!record) {
    return res.status(401).json({
      error: 'Invalid API key',
      hint: 'Generate a key from /api/developer/register or /api/developer/keys'
    });
  }

  attachDeveloper(req, record);
  next();
}

function optionalApiKey(req, res, next) {
  const apiKey = extractApiKey(req);
  if (apiKey) {
    const record = db.validateApiKey(apiKey);
    if (record) attachDeveloper(req, record);
  }
  next();
}

module.exports = {
  requireApiKey,
  optionalApiKey
};
