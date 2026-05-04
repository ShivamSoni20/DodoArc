const router = require('express').Router();
const db = require('../services/db');
const dodo = require('../services/dodo');

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
    planId: metadata.planId || metadata.plan_id || data.planId
  };
}

function activateCreditsFromPayment(eventType, data) {
  const payment = normalizePaymentData(data);
  if (!payment.email || !payment.planId) {
    db.logEvent('webhook_missing_metadata', { eventType, paymentId: payment.paymentId });
    return { activated: false, reason: 'missing email or planId metadata' };
  }

  const plan = db.getPlanById(payment.planId);
  if (!plan) return { activated: false, reason: 'plan not found' };

  const user = db.getOrCreateUser(payment.email, payment.name);
  if (payment.customerId) db.updateUser(user.id, { dodo_customer_id: payment.customerId });

  const existing = db.getSubscriptionByUser(user.id);
  const nextCreditsTotal = existing
    ? existing.credits_total + plan.credits
    : plan.credits;

  const subscription = db.upsertSubscription({
    userId: user.id,
    planId: plan.id,
    status: 'active',
    credits_total: nextCreditsTotal,
    credits_used: existing?.credits_used || 0,
    dodo_payment_id: payment.paymentId,
    dodo_subscription_id: payment.subscriptionId,
    payment_method: 'dodo',
    last_payment_amount: payment.amount,
    last_payment_currency: payment.currency
  });

  db.logEvent(existing ? 'credits_topped_up' : 'subscription_activated', {
    userId: user.id,
    email: user.email,
    planId: plan.id,
    credits: plan.credits,
    paymentId: payment.paymentId,
    amount: payment.amount,
    currency: payment.currency
  });

  return { activated: true, user, subscription };
}

router.post('/dodo', (req, res) => {
  const rawBody = req.body;
  const webhookId =
    req.headers['webhook-id'] || req.headers['dodo-webhook-id'] || `manual_${Date.now()}`;

  if (db.hasProcessedWebhook(webhookId)) {
    return res.json({ received: true, duplicate: true });
  }

  if (!dodo.verifyWebhookSignature(rawBody, req.headers)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  db.markWebhookProcessed(webhookId);
  db.logEvent('webhook_received', { webhookId, type: event.type });

  try {
    switch (event.type) {
      case 'payment.succeeded':
      case 'subscription.active':
      case 'subscription.renewed':
        activateCreditsFromPayment(event.type, event.data);
        break;
      case 'payment.failed':
      case 'subscription.failed':
      case 'subscription.on_hold':
        db.logEvent('payment_failed', { webhookId, data: event.data });
        break;
      case 'subscription.cancelled':
        db.logEvent('subscription_cancelled', { webhookId, data: event.data });
        break;
      case 'credit.added':
      case 'credit.deducted':
      case 'credit.balance_low':
        db.logEvent(event.type.replace('.', '_'), event.data);
        break;
      default:
        db.logEvent('webhook_unhandled', { webhookId, type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
