const router = require('express').Router();
const crypto = require('crypto');
const db = require('../services/db');
const { runTradingAgent } = require('../services/agent');

const AGENT_RUN_CREDITS = 10;

router.post('/run', async (req, res) => {
  const { userId, agentName = 'Trading Signal Agent' } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const remaining = db.getRemainingCredits(userId);
  if (remaining < AGENT_RUN_CREDITS) {
    return res.status(402).json({
      error: 'Insufficient credits',
      remaining,
      message: 'Buy or activate a plan before running an agent.'
    });
  }

  const runId = `run_${crypto.randomUUID().slice(0, 8)}`;
  db.logAgentRun({
    run_id: runId,
    user_id: userId,
    agent_name: agentName,
    credits_used: AGENT_RUN_CREDITS,
    status: 'running'
  });

  try {
    const deduction = db.deductCredits(userId, AGENT_RUN_CREDITS);
    if (!deduction.success) {
      db.completeAgentRun(runId, 'failed', { error: deduction.error });
      return res.status(402).json({ error: deduction.error });
    }

    const result = await runTradingAgent({ runId, userId });
    for (const receipt of result.receipts) {
      db.logSettlement({
        agent_run_id: runId,
        tool_name: receipt.tool,
        amount_usdc: receipt.amount,
        to_wallet: receipt.to,
        tx_signature: receipt.signature,
        explorer_url: receipt.explorer,
        mock: receipt.mock
      });
    }

    db.logEvent('agent_run_completed', {
      runId,
      userId,
      agentName,
      signal: result.signal,
      creditsUsed: AGENT_RUN_CREDITS,
      usdcSettled: result.totalUsdcSettled,
      mock: result.mock
    });
    db.completeAgentRun(runId, 'completed', result);

    res.json({
      success: true,
      runId,
      creditsUsed: AGENT_RUN_CREDITS,
      creditsRemaining: deduction.remaining,
      result
    });
  } catch (error) {
    console.error('[Agent] Run failed:', error);
    db.completeAgentRun(runId, 'failed', { error: error.message });
    db.logEvent('agent_run_failed', { runId, userId, error: error.message });
    res.status(500).json({ error: error.message, runId });
  }
});

router.get('/runs', (req, res) => {
  res.json({ runs: db.getRecentRuns(20) });
});

module.exports = router;
