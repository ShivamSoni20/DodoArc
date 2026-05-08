const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getMint
} = require('@solana/spl-token');
const bs58Module = require('bs58');
const config = require('../config');

const bs58 = bs58Module.default || bs58Module;
const connection = new Connection(config.SOLANA_RPC_URL, 'confirmed');
const USDC_MINT_DEVNET = new PublicKey(config.USDC_MINT_DEVNET);

function getConnection() {
  return connection;
}

function getPayerKeypair() {
  if (!config.SOLANA_PRIVATE_KEY) return null;

  try {
    return Keypair.fromSecretKey(bs58.decode(config.SOLANA_PRIVATE_KEY));
  } catch (error) {
    console.warn('Invalid SOLANA_PRIVATE_KEY, falling back to mock x402 mode:', error.message);
    return null;
  }
}

function getSettlementConfig() {
  const payer = getPayerKeypair();
  return {
    rpc_url: config.SOLANA_RPC_URL,
    usdc_mint: config.USDC_MINT_DEVNET,
    settlement_wallet:
      config.SETTLEMENT_WALLET_PUBLIC_KEY || payer?.publicKey.toBase58() || null,
    tool_provider_wallet: config.X402_TOOL_PROVIDER_WALLET || null,
    cluster: config.SOLANA_RPC_URL.includes('devnet') ? 'devnet' : 'custom',
    x402_mode: payer ? 'devnet' : 'mock'
  };
}

async function getWalletBalance(publicKey) {
  const key = new PublicKey(publicKey);
  const lamports = await connection.getBalance(key);
  return { publicKey: key.toBase58(), lamports, sol: lamports / LAMPORTS_PER_SOL };
}

function mockX402Pay({ toWallet, amountUsdc, memo, tool }) {
  const bytes = Buffer.from(Array.from({ length: 64 }, () => Math.floor(Math.random() * 256)));
  const signature = bs58.encode(bytes);
  return {
    signature,
    explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    amount: amountUsdc,
    to: toWallet,
    memo,
    tool,
    timestamp: new Date().toISOString(),
    mock: true
  };
}

async function x402Pay({ toWallet, amountUsdc, memo, tool }) {
  const payer = getPayerKeypair();
  if (!payer || !toWallet) {
    return mockX402Pay({
      toWallet: toWallet || 'DemoToolProvider1111111111111111111111111111',
      amountUsdc,
      memo,
      tool
    });
  }

  const mint = await getMint(connection, USDC_MINT_DEVNET);
  const amountRaw = Math.round(amountUsdc * Math.pow(10, mint.decimals));
  const toPublicKey = new PublicKey(toWallet);

  const fromATA = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    USDC_MINT_DEVNET,
    payer.publicKey
  );
  const toATA = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    USDC_MINT_DEVNET,
    toPublicKey
  );

  if (Number(fromATA.amount) < amountRaw) {
    throw new Error(
      `Insufficient devnet USDC. Have ${Number(fromATA.amount) / Math.pow(10, mint.decimals)}, need ${amountUsdc}.`
    );
  }

  const transaction = new Transaction().add(
    createTransferInstruction(fromATA.address, toATA.address, payer.publicKey, amountRaw)
  );
  const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);

  return {
    signature,
    explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    amount: amountUsdc,
    to: toWallet,
    memo,
    tool,
    timestamp: new Date().toISOString(),
    mock: false
  };
}

async function airdropSol(walletAddress, solAmount = 1) {
  const pubkey = new PublicKey(walletAddress);
  const signature = await connection.requestAirdrop(pubkey, solAmount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature, 'confirmed');
  return { signature, amount: solAmount, wallet: walletAddress };
}

async function getUsdcBalance(walletAddress) {
  const payer = getPayerKeypair();
  if (!payer) return 0;

  try {
    const pubkey = new PublicKey(walletAddress);
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      USDC_MINT_DEVNET,
      pubkey
    );
    const mint = await getMint(connection, USDC_MINT_DEVNET);
    return Number(ata.amount) / Math.pow(10, mint.decimals);
  } catch {
    return 0;
  }
}

module.exports = {
  connection,
  getConnection,
  getSettlementConfig,
  getWalletBalance,
  getPayerKeypair,
  x402Pay,
  mockX402Pay,
  airdropSol,
  getUsdcBalance,
  USDC_MINT_DEVNET
};
