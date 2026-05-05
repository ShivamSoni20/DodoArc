const router = require('express').Router();
const solana = require('../services/solana');

router.get('/settlement-config', (req, res) => {
  res.json(solana.getSettlementConfig());
});

router.get('/settlement-log', (req, res) => {
  res.json({
    cluster: solana.getSettlementConfig().cluster,
    settlements: [
      {
        signature: '5Kg3...mR7x',
        label: 'Perplexity MCP · demo receipt',
        amount: '0.0014 USDC',
        status: 'Ready'
      },
      {
        signature: '9Pq1...hJ2k',
        label: 'Helius API · demo receipt',
        amount: '0.0022 USDC',
        status: 'Ready'
      },
      {
        signature: '2Rn8...vW5s',
        label: 'DataFeed MCP · demo receipt',
        amount: '0.0008 USDC',
        status: 'Ready'
      }
    ]
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
