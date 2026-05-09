require('dotenv').config();

const checks = [
  ['PORT', process.env.PORT || '3000', 'ok'],
  ['BASE_URL', process.env.BASE_URL, 'warn'],
  ['DODO_PAYMENTS_API_KEY', process.env.DODO_PAYMENTS_API_KEY || process.env.DODO_API_KEY, 'warn'],
  ['DODO_PAYMENTS_WEBHOOK_SECRET', process.env.DODO_PAYMENTS_WEBHOOK_SECRET || process.env.DODO_WEBHOOK_SECRET, 'warn'],
  ['DODO_PRO_PRODUCT_ID', process.env.DODO_PRO_PRODUCT_ID, 'warn'],
  ['SOLANA_RPC_URL', process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'ok'],
  ['SOLANA_PRIVATE_KEY', process.env.SOLANA_PRIVATE_KEY, 'warn'],
  ['SETTLEMENT_WALLET_PUBLIC_KEY', process.env.SETTLEMENT_WALLET_PUBLIC_KEY, 'warn'],
  ['X402_TOOL_PROVIDER_WALLET', process.env.X402_TOOL_PROVIDER_WALLET, 'warn']
];

let warnings = 0;

console.log('DodoArc environment check');
for (const [name, value, severity] of checks) {
  if (value) {
    console.log(`OK   ${name}`);
  } else if (severity === 'warn') {
    warnings += 1;
    console.log(`WARN ${name} is not set`);
  } else {
    console.log(`OK   ${name} uses default`);
  }
}

if (warnings) {
  console.log(`\n${warnings} warning(s). Demo can still run with mock/fallback paths where supported.`);
} else {
  console.log('\nEnvironment is fully configured.');
}
