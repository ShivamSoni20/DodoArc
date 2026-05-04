require('dotenv').config();

const DodoPayments = require('dodopayments').default || require('dodopayments');

async function main() {
  if (!process.env.DODO_PAYMENTS_API_KEY) {
    throw new Error('Set DODO_PAYMENTS_API_KEY before running this script.');
  }

  const client = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode'
  });

  console.log('Create DodoArc Pro in the Dodo dashboard if this SDK version does not support product creation.');
  console.log('Recommended product: DodoArc Pro, subscription, INR 2999/month, 1000 agent credits.');
  console.log('After creation, set DODO_PRO_PRODUCT_ID in .env.');

  if (client.products?.create) {
    const product = await client.products.create({
      name: 'DodoArc Pro',
      description: '1,000 agent credits per month for AI agent products with Solana settlement dashboard.',
      price: {
        amount: 299900,
        currency: 'INR',
        type: 'recurring'
      },
      tax_category: 'saas'
    });
    console.log('Created product:', product);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
