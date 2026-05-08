module.exports = {
  PORT: Number(process.env.PORT || 3000),
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  FRONTEND_URL: process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 3000}`,

  DODO_PAYMENTS_API_KEY: process.env.DODO_PAYMENTS_API_KEY || process.env.DODO_API_KEY || '',
  DODO_PAYMENTS_WEBHOOK_SECRET:
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET || process.env.DODO_WEBHOOK_SECRET || '',
  DODO_PAYMENTS_ENVIRONMENT:
    process.env.DODO_PAYMENTS_ENVIRONMENT || process.env.DODO_MODE || 'test_mode',
  DODO_PRO_PRODUCT_ID: process.env.DODO_PRO_PRODUCT_ID || '',
  ALLOW_UNSIGNED_TEST_WEBHOOKS: process.env.ALLOW_UNSIGNED_TEST_WEBHOOKS !== 'false',
  DASHBOARD_API_KEY: process.env.DASHBOARD_API_KEY || '',

  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  SOLANA_PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY || '',
  USDC_MINT_DEVNET:
    process.env.USDC_MINT_DEVNET || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  SETTLEMENT_WALLET_PUBLIC_KEY: process.env.SETTLEMENT_WALLET_PUBLIC_KEY || '',
  X402_TOOL_PROVIDER_WALLET: process.env.X402_TOOL_PROVIDER_WALLET || ''
};
