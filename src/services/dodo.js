const crypto = require('crypto');
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

function extractV1Signature(signatureHeader = '') {
  const pair = signatureHeader
    .split(' ')
    .join(',')
    .split(',')
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith('v'));
  return pair || '';
}

function verifyWebhookSignature(rawBody, headers) {
  const secret = config.DODO_PAYMENTS_WEBHOOK_SECRET;
  const signature = headers['webhook-signature'] || headers['dodo-signature'] || '';
  const timestamp = headers['webhook-timestamp'] || '';

  if (!secret) {
    return config.ALLOW_UNSIGNED_TEST_WEBHOOKS;
  }

  if (!signature || !timestamp) return false;

  const eventTime = Number(timestamp) * 1000;
  if (!Number.isFinite(eventTime) || Math.abs(Date.now() - eventTime) > 5 * 60 * 1000) {
    return false;
  }

  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('base64');
  const provided = extractV1Signature(signature);

  if (!provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

module.exports = {
  createCheckoutSession,
  verifyWebhookSignature,
  hasLiveDodoConfig
};
