const { Connection, PublicKey } = require('@solana/web3.js');
const config = require('../config');

function getConnection() {
  return new Connection(config.SOLANA_RPC_URL, 'confirmed');
}

function getSettlementConfig() {
  return {
    rpc_url: config.SOLANA_RPC_URL,
    usdc_mint: config.USDC_MINT_DEVNET,
    settlement_wallet: config.SETTLEMENT_WALLET_PUBLIC_KEY || null,
    cluster: config.SOLANA_RPC_URL.includes('devnet') ? 'devnet' : 'custom'
  };
}

async function getWalletBalance(publicKey) {
  const key = new PublicKey(publicKey);
  const lamports = await getConnection().getBalance(key);
  return { publicKey: key.toBase58(), lamports, sol: lamports / 1_000_000_000 };
}

module.exports = {
  getConnection,
  getSettlementConfig,
  getWalletBalance
};
