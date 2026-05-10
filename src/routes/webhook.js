const router = require('express').Router();
const db = require('../services/db');
const dodo = require('../services/dodo');

function parseRawBody(rawBody) {
  const bodyText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '{}');
  return { bodyText, event: JSON.parse(bodyText) };
}

function getEventId(event, headers) {
  return (
    headers['webhook-id'] ||
    headers['dodo-webhook-id'] ||
    event.id ||
    event.data?.event_id ||
    event.data?.payment_id ||
    event.data?.id ||
    `evt_${Date.now()}`
  );
}

function normalizePaymentData(data = {}) {
  const customer = data.customer || {};
  const metadata = data.metadata || {};

  return {
    paymentId: data.payment_id || data.id || data.paymentId,
    subscriptionId: data.subscription_id || data.subscriptionId,
    amount: data.total_amount || data.amount,
    currency: data.currency || 'INR',
    customerId: customer.customer_id || data.customer_id || metadata.dodo_customer_id,
    email: customer.email || metadata.email,
    name: customer.name || metadata.name,
    planId: metadata.planId || metadata.plan_id || data.planId,
    appId: metadata.appId || metadata.app_id || data.appId || null,
    developerId: metadata.developerId || metadata.developer_id || data.developerId || null
  };
}

function activateCreditsFromPayment(eventType, data) {
  const payment = normalizePaymentData(data);
  if (!payment.email || !payment.planId) {
    db.logEvent('webhook_missing_metadata', { eventType, paymentId: payment.paymentId });
    return 'skipped_missing_metadata';
  }

  const plan = db.getPlanById(payment.planId);
  if (!plan) return `skipped_unknown_plan_${payment.planId}`;

  const user = db.getOrCreateUser(payment.email, payment.name);
  if (payment.customerId) db.updateUser(user.id, { dodo_customer_id: payment.customerId });

  const existing = db.getSubscriptionByUser(user.id, {
    developerId: payment.developerId,
    appId: payment.appId
  });
  const creditsTotal = existing ? existing.credits_total + plan.credits : plan.credits;
  const subscription = db.upsertSubscription({
    userId: user.id,
    planId: plan.id,
    status: 'active',
    credits_total: creditsTotal,
    credits_used: existing?.credits_used || 0,
    dodo_payment_id: payment.paymentId,
    dodo_subscription_id: payment.subscriptionId,
    payment_method: 'dodo',
    last_payment_amount: payment.amount,
    last_payment_currency: payment.currency,
    developer_id: payment.developerId,
    app_id: payment.appId
  });

  if (payment.appId && payment.developerId) {
    db.registerAppUser(payment.appId, payment.developerId, user.id);
    db.ensureAppPolicy(payment.appId, payment.developerId);
  }

  const actionTaken = existing
    ? `renewed_credits_+${plan.credits}`
    : `new_subscription_${plan.credits}_credits`;

  db.logEvent(existing ? 'credits_topped_up' : 'subscription_activated', {
    userId: user.id,
    subscriptionId: subscription.id,
    email: user.email,
    planId: plan.id,
    credits: plan.credits,
    paymentId: payment.paymentId,
    amount: payment.amount,
    currency: payment.currency,
    developerId: payment.developerId,
    appId: payment.appId
  });

  return actionTaken;
}

function pauseSubscriptionFromFailure(data = {}) {
  const payment = normalizePaymentData(data);
  if (!payment.email) return 'skipped_missing_email';

  const user = db.getOrCreateUser(payment.email, payment.name);
  const subscription = db.getSubscriptionByUser(user.id, {
    developerId: payment.developerId,
    appId: payment.appId
  });
  if (!subscription) return 'skipped_no_subscription';

  db.updateSubscription(subscription.id, {
    status: 'paused',
    credits_total: subscription.credits_total
  });
  db.logEvent(
    'subscription_paused',
    {
      userId: user.id,
      reason: 'payment_failed',
      developerId: payment.developerId,
      appId: payment.appId
    },
    {
      developerId: payment.developerId,
      appId: payment.appId
    }
  );
  return `paused_subscription_${subscription.id}`;
}

function processEvent(event) {
  switch (event.type) {
    case 'payment.succeeded':
    case 'subscription.active':
    case 'subscription.renewed':
      return activateCreditsFromPayment(event.type, event.data);
    case 'payment.failed':
    case 'subscription.failed':
    case 'subscription.on_hold':
      return pauseSubscriptionFromFailure(event.data);
    case 'subscription.cancelled':
      db.logEvent('subscription_cancelled', { id: event.data?.id || event.data?.subscription_id });
      return 'logged_cancellation';
    case 'credit.added':
    case 'credit.deducted':
    case 'credit.balance_low':
      db.logEvent(event.type.replace('.', '_'), event.data);
      return `logged_${event.type}`;
    default:
      db.logEvent('webhook_unhandled', { type: event.type });
      return `unhandled_type_${event.type}`;
  }
}

router.post('/dodo', (req, res) => {
  let eventId = 'unknown';

  try {
    if (!dodo.verifyWebhookSignature(req.body, req.headers)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { bodyText, event } = parseRawBody(req.body);
    eventId = getEventId(event, req.headers);
    const paymentContext = normalizePaymentData(event.data || {});

    if (db.isWebhookAlreadyProcessed(eventId)) {
      return res.json({ received: true, duplicate: true, eventId });
    }

    db.logWebhookReceived(eventId, event.type || 'unknown', bodyText);
    db.logEvent(
      'webhook_received',
      {
        eventId,
        type: event.type,
        developerId: paymentContext.developerId,
        appId: paymentContext.appId
      },
      {
        developerId: paymentContext.developerId,
        appId: paymentContext.appId
      }
    );

    const actionTaken = processEvent(event);
    db.markWebhookProcessed(eventId, actionTaken);
    req.app.locals.broadcast?.('subscription_update', {
      type: event.type,
      action: actionTaken,
      eventId
    });
    res.json({ received: true, eventId, action: actionTaken });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    if (eventId !== 'unknown') {
      db.markWebhookFailed(eventId, error.message);
    }
    res.json({ received: true, eventId, error: error.message });
  }
});

module.exports = router;
