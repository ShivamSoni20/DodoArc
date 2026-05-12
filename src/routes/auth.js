const router = require('express').Router();
const db = require('../services/db');
const { clearSessionCookie, parseCookies, setSessionCookie } = require('../middleware/auth');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function publicAccount(account) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role
  };
}

function createFounderSession(account) {
  const apiKey = db.generateApiKey(account.developerId, `Founder session ${new Date().toISOString().slice(0, 10)}`).key;
  const session = db.createAuthSession(account.id, apiKey);
  return { session, apiKey };
}

router.post('/signup', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const name = String(req.body.name || '').trim();
  const role = req.body.role === 'founder' ? 'founder' : 'user';
  const password = String(req.body.password || '');

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  if (!validatePassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (db.getAuthAccountByEmailRole(email, role)) {
    return res.status(409).json({ error: `An account already exists for this ${role}` });
  }

  let userId = null;
  let developerId = null;

  if (role === 'founder') {
    const developer = db.getDeveloperByEmail(email) || db.createDeveloper(email, name || email.split('@')[0]);
    developerId = developer.id;
  } else {
    const user = db.getUserByEmail(email) || db.getOrCreateUser(email, name || email.split('@')[0]);
    userId = user.id;
  }

  const account = db.createAuthAccount({
    email,
    name: name || email.split('@')[0],
    role,
    password,
    userId,
    developerId
  });

  const { session, apiKey } = role === 'founder'
    ? createFounderSession(account)
    : { session: db.createAuthSession(account.id), apiKey: null };

  setSessionCookie(res, session.token, session.expiresAt);
  res.status(201).json({
    success: true,
    account: publicAccount(account),
    redirectTo: role === 'founder' ? '/dashboard' : '/app',
    apiKey
  });
});

router.post('/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const role = req.body.role === 'founder' ? 'founder' : 'user';
  const password = String(req.body.password || '');

  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const account = db.validatePassword(email, role, password);
  if (!account) {
    return res.status(401).json({ error: 'Invalid email, password, or role' });
  }

  const { session, apiKey } = role === 'founder'
    ? createFounderSession(account)
    : { session: db.createAuthSession(account.id), apiKey: null };

  setSessionCookie(res, session.token, session.expiresAt);
  res.json({
    success: true,
    account: publicAccount(account),
    redirectTo: role === 'founder' ? '/dashboard' : '/app',
    apiKey
  });
});

router.post('/logout', (req, res) => {
  const token = parseCookies(req).dodoarc_session;
  if (token) db.deleteAuthSession(token);
  clearSessionCookie(res);
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  if (!req.account) return res.status(401).json({ error: 'Not authenticated' });

  if (req.account.role === 'founder') {
    const developer = db.getDeveloperById(req.account.developerId);
    return res.json({
      account: publicAccount(req.account),
      developer,
      apps: db.getAppsByDeveloper(req.account.developerId),
      apiKey: req.authSession?.apiKey || null
    });
  }

  const user = db.getUserById(req.account.userId);
  const subscriptions = db.getSubscriptionsByUserId(req.account.userId).map((sub) => ({
    ...sub,
    plan: db.getPlanById(sub.planId),
    creditsRemaining: Number(sub.credits_total || 0) - Number(sub.credits_used || 0)
  }));

  res.json({
    account: publicAccount(req.account),
    user,
    subscriptions
  });
});

module.exports = router;
