const router = require('express').Router();
const solana = require('../services/solana');

router.get('/settlement-config', (req, res) => {
  res.json(solana.getSettlementConfig());
});

router.get('/balance/:publicKey', async (req, res) => {
  try {
    res.json(await solana.getWalletBalance(req.params.publicKey));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
