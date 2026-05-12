const router = require('express').Router();
const crypto = require('crypto');
const db = require('../services/db');
const { runTradingAgent } = require('../services/agent');
const { requireApiKey } = require('../middleware/auth');

router.post('/run', requireApiKey, async (req, res) => {
  const { userId, agentName = 'Backend Spend Flow', appId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  let effectiveAppId = appId || null;
  let scopedSubscription = null;
  let runCredits = 10;

  if (effectiveAppId) {
    const app = db.getAppById(effectiveAppId);
    if (!app || app.developerId !== req.developer.id) {
      return res.status(404).json({ error: 'App not found' });
    }
    runCredits = Number(app.creditsPerRun || 10);
    if (!db.isUserInApp(effectiveAppId, req.developer.id, userId)) {
      return res.status(404).json({ error: 'User is not linked to this app' });
    }
    scopedSubscription = db.getSubscriptionByUser(userId, {
      developerId: req.developer.id,
      appId: effectiveAppId
    });
  } else {
    scopedSubscription = db.getSubscriptionByUser(userId, {
      developerId: req.developer.id
    });
    effectiveAppId = scopedSubscription?.appId || null;
  }

  if (!scopedSubscription) {
    return res.status(404).json({
      error: 'No active subscription for this developer or app',
      code: 'SUBSCRIPTION_SCOPE_MISSING'
    });
  }

  if (effectiveAppId) {
    const policy = db.getAppPolicy(effectiveAppId);
    if (policy) {
      if (policy.paused) {
        return res.status(403).json({
          error: 'App is paused by operator',
          code: 'APP_PAUSED',
          appId: effectiveAppId
        });
      }

      const todaySpend = db.getDailySpend(effectiveAppId);
      if (todaySpend >= policy.daily_spend_cap) {
        return res.status(402).json({
          error: 'Daily spend cap reached',
          code: 'DAILY_CAP_EXCEEDED',
          cap: policy.daily_spend_cap,
          spent: todaySpend,
          resets: 'midnight UTC'
        });
      }

      if (runCredits > policy.max_credits_per_run) {
        return res.status(402).json({
          error: 'Run cost exceeds app policy limit',
          code: 'PER_RUN_LIMIT_EXCEEDED',
          limit: policy.max_credits_per_run,
          requested: runCredits
        });
      }

      if (runCredits > policy.require_approval_above) {
        db.logEvent(
          'agent_run_pending_approval',
          {
            userId,
            appId: effectiveAppId,
            creditsRequested: runCredits,
            developerId: req.developer.id
          },
          { developerId: req.developer.id, appId: effectiveAppId }
        );
        return res.status(202).json({
          status: 'pending_approval',
          code: 'APPROVAL_REQUIRED',
          message: 'Run requires operator approval before execution',
          threshold: policy.require_approval_above,
          requested: runCredits
        });
      }
    }
  }

  const remaining = db.getRemainingCredits(userId, {
    developerId: req.developer.id,
    appId: effectiveAppId
  });
  if (remaining < runCredits) {
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
    developer_id: req.developer.id,
    app_id: effectiveAppId,
    agent_name: agentName,
    credits_used: runCredits,
    status: 'running',
    policy_applied: effectiveAppId ? db.getAppPolicy(effectiveAppId) : null
  });

  try {
    const deduction = db.deductCredits(userId, runCredits, {
      developerId: req.developer.id,
      appId: effectiveAppId
    });
    if (!deduction.success) {
      db.completeAgentRun(runId, 'failed', { error: deduction.error });
      return res.status(402).json({ error: deduction.error });
    }

    const result = await runTradingAgent({ runId, userId });
    for (const receipt of result.receipts) {
      db.logSettlement({
        agent_run_id: runId,
        developer_id: req.developer.id,
        app_id: effectiveAppId,
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
      developerId: req.developer.id,
      agentName,
      signal: result.signal,
      creditsUsed: runCredits,
      usdcSettled: result.totalUsdcSettled,
      mock: result.mock,
      appId: effectiveAppId
    });
    db.completeAgentRun(runId, 'completed', result);
    req.app.locals.broadcast?.('agent_run_complete', {
      runId,
      userId,
      signal: result.signal,
      creditsUsed: runCredits,
      usdcSettled: result.totalUsdcSettled
    });

    res.json({
      success: true,
      runId,
      creditsUsed: runCredits,
      creditsRemaining: deduction.remaining,
      result
    });
  } catch (error) {
    console.error('[Agent] Run failed:', error);
    db.completeAgentRun(runId, 'failed', { error: error.message });
    db.logEvent(
      'agent_run_failed',
      { runId, userId, developerId: req.developer.id, appId: effectiveAppId, error: error.message },
      { developerId: req.developer.id, appId: effectiveAppId }
    );
    res.status(500).json({ error: error.message, runId });
  }
});

router.get('/runs', requireApiKey, (req, res) => {
  res.json({ runs: db.getRunsByDeveloper(req.developer.id, 20) });
});

module.exports = router;
