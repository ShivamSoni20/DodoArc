const router = require('express').Router();
const db = require('../services/db');
const solana = require('../services/solana');

router.get('/settlement-config', (req, res) => {
  res.json(solana.getSettlementConfig());
});

router.get('/settlement-log', (req, res) => {
  const receipts = db.getRecentSettlements(20);
  const allReceipts = db.getRecentSettlements(1000);
  const totalSettled = allReceipts.reduce((sum, receipt) => sum + Number(receipt.amount_usdc || 0), 0);

  res.json({
    receipts: receipts.map((receipt) => ({
      id: receipt.id,
      agentRunId: receipt.agent_run_id,
      tool: receipt.tool_name,
      amountUsdc: receipt.amount_usdc,
      toWallet: receipt.to_wallet,
      signature: receipt.tx_signature,
      explorer: receipt.explorer_url,
      mock: Boolean(receipt.mock),
      timestamp: receipt.created_at
    })),
    totalSettled,
    network: solana.getSettlementConfig().cluster,
    count: receipts.length
  });
});

router.post('/connect-wallet', (req, res) => {
  const { wallet, demo } = req.body;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });

  process.env.CONNECTED_WALLET = wallet;
  process.env.WALLET_IS_DEMO = demo ? '1' : '0';
  db.logEvent('wallet_connected', {
    wallet: `${wallet.slice(0, 8)}...${wallet.slice(-4)}`,
    demo: Boolean(demo)
  });

  res.json({ success: true, wallet, demo: Boolean(demo), network: 'devnet' });
});

router.get('/wallet-status', (req, res) => {
  const wallet = process.env.CONNECTED_WALLET || null;
  res.json({
    connected: Boolean(wallet),
    wallet,
    demo: process.env.WALLET_IS_DEMO === '1',
    network: 'devnet',
    explorer: wallet ? `https://explorer.solana.com/address/${wallet}?cluster=devnet` : null
  });
});

router.get('/balance/:publicKey', async (req, res) => {
  try {
    res.json(await solana.getWalletBalance(req.params.publicKey));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
