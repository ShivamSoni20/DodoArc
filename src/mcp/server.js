const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const crypto = require('crypto');
const db = require('../services/db');
const { runTradingAgent } = require('../services/agent');

const server = new McpServer({
  name: 'dodoarc',
  version: '1.0.0'
});

function text(payload) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function resolveScope({ developerId = null, appId = null } = {}) {
  return {
    developerId: developerId || null,
    appId: appId || null
  };
}

function getScopedSubscription(userId, scope) {
  return db.getSubscriptionByUser(userId, scope);
}

function getScopedRuns(scope, limit = 50) {
  if (scope.developerId) return db.getRunsByDeveloper(scope.developerId, limit);
  return db.getRecentRuns(limit);
}

function getScopedSettlements(scope, limit = 50) {
  if (scope.developerId) return db.getSettlementsByDeveloper(scope.developerId, limit);
  return db.getRecentSettlements(limit);
}

function getScopedMetrics(scope) {
  const subscriptions = scope.developerId
    ? db.getSubscriptionsByDeveloper(scope.developerId)
    : db.getAllSubscriptions();
  const settlements = getScopedSettlements(scope, 50);
  const runs = getScopedRuns(scope, 50);
  const mrr = subscriptions
    .filter((sub) => sub.status === 'active')
    .reduce((sum, sub) => sum + Number(db.getPlanById(sub.planId)?.price || 0), 0);
  const totalUsdcSettled = settlements.reduce((sum, receipt) => sum + Number(receipt.amount_usdc || 0), 0);

  return {
    mrr,
    activeSubscribers: subscriptions.filter((sub) => sub.status === 'active').length,
    totalSubscribers: subscriptions.length,
    totalCreditsUsed: subscriptions.reduce((sum, sub) => sum + Number(sub.credits_used || 0), 0),
    totalCreditsGranted: subscriptions.reduce((sum, sub) => sum + Number(sub.credits_total || 0), 0),
    totalUsdcSettled: Number(totalUsdcSettled.toFixed(6)),
    completedAgentRuns: runs.filter((run) => run.status === 'completed').length,
    network: 'devnet',
    timestamp: new Date().toISOString()
  };
}

function enforcePolicy(scope, userId, requestedCredits) {
  if (!scope.appId) return null;

  const app = db.getAppById(scope.appId);
  if (!app) {
    return { status: 404, payload: { error: 'App not found', code: 'APP_NOT_FOUND', appId: scope.appId } };
  }
  if (scope.developerId && app.developerId !== scope.developerId) {
    return { status: 404, payload: { error: 'App does not belong to developer', code: 'APP_SCOPE_INVALID', appId: scope.appId } };
  }
  if (scope.developerId && !db.isUserInApp(scope.appId, scope.developerId, userId)) {
    return { status: 404, payload: { error: 'User is not linked to this app', code: 'USER_NOT_IN_APP', appId: scope.appId } };
  }

  const policy = db.getAppPolicy(scope.appId);
  if (!policy) return null;
  if (policy.paused) {
    return { status: 403, payload: { error: 'App is paused by operator', code: 'APP_PAUSED', appId: scope.appId } };
  }

  const todaySpend = db.getDailySpend(scope.appId);
  if (todaySpend >= policy.daily_spend_cap) {
    return {
      status: 402,
      payload: {
        error: 'Daily spend cap reached',
        code: 'DAILY_CAP_EXCEEDED',
        cap: policy.daily_spend_cap,
        spent: todaySpend,
        resets: 'midnight UTC'
      }
    };
  }

  if (requestedCredits > policy.max_credits_per_run) {
    return {
      status: 402,
      payload: {
        error: 'Run cost exceeds app policy limit',
        code: 'PER_RUN_LIMIT_EXCEEDED',
        limit: policy.max_credits_per_run,
        requested: requestedCredits
      }
    };
  }

  if (requestedCredits > policy.require_approval_above) {
    db.logEvent(
      'agent_run_pending_approval_mcp',
      {
        userId,
        appId: scope.appId,
        developerId: scope.developerId,
        creditsRequested: requestedCredits
      },
      scope
    );
    return {
      status: 202,
      payload: {
        status: 'pending_approval',
        code: 'APPROVAL_REQUIRED',
        threshold: policy.require_approval_above,
        requested: requestedCredits
      }
    };
  }

  return null;
}

server.tool(
  'check_credits',
  'Check remaining DodoArc credits for a subscribed user.',
  {
    userId: z.string().describe('DodoArc user ID'),
    developerId: z.string().optional().describe('Optional developer scope'),
    appId: z.string().optional().describe('Optional app scope')
  },
  async ({ userId, developerId, appId }) => {
    const scope = resolveScope({ developerId, appId });
    const subscription = getScopedSubscription(userId, scope);
    if (!subscription) {
      return text({ userId, developerId: scope.developerId, appId: scope.appId, status: 'no_subscription', creditsRemaining: 0 });
    }
    return text({
      userId,
      developerId: scope.developerId,
      appId: scope.appId,
      status: subscription.status,
      planId: subscription.planId,
      creditsTotal: subscription.credits_total,
      creditsUsed: subscription.credits_used,
      creditsRemaining: subscription.credits_total - subscription.credits_used
    });
  }
);

server.tool(
  'consume_credits',
  'Consume DodoArc credits for an external agent action.',
  {
    userId: z.string().describe('DodoArc user ID'),
    amount: z.number().positive().describe('Credits to consume'),
    developerId: z.string().optional().describe('Optional developer scope'),
    appId: z.string().optional().describe('Optional app scope'),
    agentName: z.string().optional().describe('Agent name for the usage event'),
    action: z.string().optional().describe('Action label')
  },
  async ({ userId, amount, developerId, appId, agentName = 'MCP Agent', action = 'mcp.consume' }) => {
    const scope = resolveScope({ developerId, appId });
    const subscription = getScopedSubscription(userId, scope);
    if (!subscription) {
      return {
        ...text({ success: false, error: 'No active subscription in scope', userId, developerId: scope.developerId, appId: scope.appId, amount }),
        isError: true
      };
    }

    const result = db.deductCredits(userId, amount, {
      developerId: scope.developerId,
      appId: subscription.appId || scope.appId
    });
    if (!result.success) {
      return { ...text({ success: false, error: result.error, userId, amount }), isError: true };
    }
    db.logEvent(
      'credits_consumed_mcp',
      {
        userId,
        amount,
        agentName,
        action,
        developerId: scope.developerId,
        appId: subscription.appId || scope.appId
      },
      {
        developerId: scope.developerId,
        appId: subscription.appId || scope.appId
      }
    );
    return text({
      success: true,
      userId,
      developerId: scope.developerId,
      appId: subscription.appId || scope.appId,
      consumed: amount,
      remaining: result.remaining
    });
  }
);

server.tool(
  'run_agent',
  'Run the DodoArc demo trading agent, consume 10 credits, and create x402-style Solana settlement receipts.',
  {
    userId: z.string().describe('DodoArc user ID'),
    developerId: z.string().optional().describe('Optional developer scope'),
    appId: z.string().optional().describe('Optional app scope'),
    agentName: z.string().optional().describe('Agent name')
  },
  async ({ userId, developerId, appId, agentName = 'MCP Agent' }) => {
    const scope = resolveScope({ developerId, appId });
    const subscription = getScopedSubscription(userId, scope);
    if (!subscription) {
      return {
        ...text({ success: false, error: 'No active subscription in scope', userId, developerId: scope.developerId, appId: scope.appId }),
        isError: true
      };
    }

    const effectiveAppId = subscription.appId || scope.appId;
    const effectiveScope = resolveScope({ developerId: scope.developerId || subscription.developerId, appId: effectiveAppId });
    const policyBlock = enforcePolicy(effectiveScope, userId, 10);
    if (policyBlock) {
      return { ...text({ success: false, ...policyBlock.payload }), isError: policyBlock.status >= 400 };
    }

    const remaining = db.getRemainingCredits(userId, {
      developerId: effectiveScope.developerId,
      appId: effectiveScope.appId
    });
    if (remaining < 10) {
      return { ...text({ success: false, error: 'Insufficient credits', remaining, developerId: effectiveScope.developerId, appId: effectiveScope.appId }), isError: true };
    }

    const runId = `mcp_run_${crypto.randomUUID().slice(0, 8)}`;
    db.logAgentRun({
      run_id: runId,
      user_id: userId,
      developer_id: effectiveScope.developerId,
      app_id: effectiveScope.appId,
      agent_name: agentName,
      credits_used: 10,
      status: 'running',
      policy_applied: effectiveScope.appId ? db.getAppPolicy(effectiveScope.appId) : null
    });
    const deduction = db.deductCredits(userId, 10, {
      developerId: effectiveScope.developerId,
      appId: effectiveScope.appId
    });
    if (!deduction.success) {
      db.completeAgentRun(runId, 'failed', { error: deduction.error });
      return { ...text({ success: false, error: deduction.error }), isError: true };
    }

    const result = await runTradingAgent({ runId, userId });
    for (const receipt of result.receipts) {
      db.logSettlement({
        agent_run_id: runId,
        developer_id: effectiveScope.developerId,
        app_id: effectiveScope.appId,
        tool_name: receipt.tool,
        amount_usdc: receipt.amount,
        to_wallet: receipt.to,
        tx_signature: receipt.signature,
        explorer_url: receipt.explorer,
        mock: receipt.mock
      });
    }
    db.completeAgentRun(runId, 'completed', result);
    db.logEvent(
      'agent_run_completed_mcp',
      {
        runId,
        userId,
        developerId: effectiveScope.developerId,
        appId: effectiveScope.appId,
        signal: result.signal,
        usdcSettled: result.totalUsdcSettled
      },
      effectiveScope
    );

    return text({
      success: true,
      runId,
      developerId: effectiveScope.developerId,
      appId: effectiveScope.appId,
      creditsUsed: 10,
      creditsRemaining: deduction.remaining,
      result
    });
  }
);

server.tool(
  'get_settlement_log',
  'Get recent x402-style USDC settlement receipts from Solana devnet.',
  {
    limit: z.number().min(1).max(50).optional().describe('Receipt limit'),
    developerId: z.string().optional().describe('Optional developer scope')
  },
  async ({ limit = 10, developerId }) => {
    const scope = resolveScope({ developerId });
    const receipts = getScopedSettlements(scope, limit);
    const totalSettled = receipts.reduce((sum, receipt) => sum + Number(receipt.amount_usdc || 0), 0);
    return text({
      receipts,
      totalSettled,
      developerId: scope.developerId,
      network: 'devnet',
      count: receipts.length
    });
  }
);

server.tool(
  'get_dashboard_metrics',
  'Get DodoArc platform metrics for subscriptions, credits, agent runs, and USDC settlement.',
  {
    developerId: z.string().optional().describe('Optional developer scope')
  },
  async ({ developerId }) => {
    const scope = resolveScope({ developerId });
    return text({
      developerId: scope.developerId,
      ...getScopedMetrics(scope)
    });
  }
);

async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[DodoArc MCP] Server started on stdio');
}

module.exports = {
  server,
  startMcpServer
};
