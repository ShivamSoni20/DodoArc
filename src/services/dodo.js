const { Webhook } = require('standardwebhooks');
const config = require('../config');

let DodoPayments;
try {
  DodoPayments = require('dodopayments').default || require('dodopayments');
} catch {
  DodoPayments = null;
}

function hasLiveDodoConfig(productId) {
  return Boolean(config.DODO_PAYMENTS_API_KEY && productId && DodoPayments);
}

function getClient() {
  if (!DodoPayments) {
    throw new Error('dodopayments SDK is not installed');
  }

  return new DodoPayments({
    bearerToken: config.DODO_PAYMENTS_API_KEY,
    environment: config.DODO_PAYMENTS_ENVIRONMENT
  });
}

async function createCheckoutSession({ plan, user, metadata }) {
  if (!hasLiveDodoConfig(plan.dodo_product_id)) {
    return {
      checkout_url:
        `${config.BASE_URL}/checkout/mock-success?planId=${encodeURIComponent(plan.id)}` +
        `&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || '')}`,
      checkout_session_id: `mock_checkout_${Date.now()}`,
      mode: 'mock'
    };
  }

  const client = getClient();
  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: plan.dodo_product_id, quantity: 1 }],
    customer: {
      email: user.email,
      name: user.name
    },
    metadata,
    return_url: `${config.BASE_URL}/payment-success?plan=${plan.id}`
  });

  return {
    checkout_url: session.checkout_url,
    checkout_session_id: session.checkout_session_id,
    mode: 'dodo'
  };
}

function verifyWebhookSignature(rawBody, headers) {
  const secret = config.DODO_PAYMENTS_WEBHOOK_SECRET;

  if (!secret) {
    return config.ALLOW_UNSIGNED_TEST_WEBHOOKS;
  }

  try {
    const webhook = new Webhook(secret);
    webhook.verify(rawBody, {
      'webhook-id': headers['webhook-id'],
      'webhook-signature': headers['webhook-signature'],
      'webhook-timestamp': headers['webhook-timestamp']
    });
    return true;
  } catch (error) {
    console.warn('Dodo webhook verification failed:', error.message);
    return false;
  }
}

module.exports = {
  createCheckoutSession,
  verifyWebhookSignature,
  hasLiveDodoConfig
};
