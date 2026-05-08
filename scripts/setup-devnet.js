require('dotenv').config();

const solana = require('../src/services/solana');

async function main() {
  const payer = solana.getPayerKeypair();
  if (!payer) {
    console.log('No SOLANA_PRIVATE_KEY configured. DodoArc will use mock x402 receipts.');
    console.log('Set SOLANA_PRIVATE_KEY to enable real devnet USDC transfers.');
    return;
  }

  const wallet = payer.publicKey.toBase58();
  console.log('DodoArc devnet setup');
  console.log('Wallet:', wallet);
  console.log('Explorer:', `https://explorer.solana.com/address/${wallet}?cluster=devnet`);

  try {
    console.log('Requesting 1 SOL devnet airdrop...');
    const airdrop = await solana.airdropSol(wallet, 1);
    console.log('Airdrop signature:', airdrop.signature);
  } catch (error) {
    console.warn('Airdrop failed, likely faucet rate limiting:', error.message);
  }

  const usdc = await solana.getUsdcBalance(wallet);
  console.log('Devnet USDC balance:', usdc);
  if (usdc < 0.01) {
    console.log('Get devnet USDC from a faucet before running real x402 transfers.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
