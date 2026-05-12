const db = require('../services/db');

const SESSION_COOKIE = 'dodoarc_session';

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  if (!raw) return {};
  return raw.split(';').reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function extractApiKey(req) {
  const headerKey = req.headers['x-api-key'];
  const authorization = req.headers.authorization || '';
  if (headerKey) return String(headerKey).trim();
  if (authorization.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim();
  if (req.authSession?.apiKey) return req.authSession.apiKey;
  return '';
}

function attachDeveloper(req, record) {
  req.developer = {
    id: record.developer_id,
    email: record.developer_email,
    name: record.developer_name
  };
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    expires: new Date(expiresAt)
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/'
  });
}

function attachSession(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    const session = db.getAuthSession(token);
    if (session) {
      req.authSession = session;
      req.account = session.account;
    } else {
      clearSessionCookie(res);
    }
  }
  next();
}

function requireRoleJson(role) {
  return (req, res, next) => {
    if (req.account?.role !== role) {
      return res.status(401).json({
        error: 'Authentication required',
        role,
        login: `/login?role=${role}`
      });
    }
    next();
  };
}

function requireRolePage(role) {
  return (req, res, next) => {
    if (req.account?.role !== role) {
      const redirectTo = encodeURIComponent(req.originalUrl || (role === 'founder' ? '/dashboard' : '/app'));
      return res.redirect(`/login?role=${role}&next=${redirectTo}`);
    }
    next();
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
  SESSION_COOKIE,
  attachSession,
  clearSessionCookie,
  extractApiKey,
  optionalApiKey,
  parseCookies,
  requireApiKey,
  requireRoleJson,
  requireRolePage,
  setSessionCookie
};
