require('dotenv').config();

const config = require('../src/config');
const db = require('../src/services/db');
const dodo = require('../src/services/dodo');

async function verifyDodoCheckout() {
  console.log('DodoArc Dodo checkout verification');
  console.log('Environment:', config.DODO_PAYMENTS_ENVIRONMENT);
  console.log('API key:', config.DODO_PAYMENTS_API_KEY ? `${config.DODO_PAYMENTS_API_KEY.slice(0, 12)}...` : 'missing');
  console.log('Pro product:', config.DODO_PRO_PRODUCT_ID || 'missing');

  if (!config.DODO_PAYMENTS_API_KEY || !config.DODO_PRO_PRODUCT_ID) {
    console.log('Live verification skipped. Set DODO_PAYMENTS_API_KEY and DODO_PRO_PRODUCT_ID first.');
    return;
  }

  const plan = db.getPlanById('plan_pro');
  const user = db.getOrCreateUser('verify@dodoarc.xyz', 'DodoArc Verify');
  const session = await dodo.createCheckoutSession({
    plan,
    user,
    metadata: {
      app: 'dodoarc',
      verification: 'true',
      planId: plan.id,
      userId: user.id,
      email: user.email
    }
  });

  if (session.mode !== 'dodo') {
    throw new Error('Expected a live Dodo checkout session, received mock mode.');
  }

  console.log('Checkout session created:', session.checkout_session_id);
  console.log('Payment URL:', session.checkout_url);
}

verifyDodoCheckout().catch((error) => {
  console.error('Dodo checkout verification failed:', error.message);
  process.exitCode = 1;
});
