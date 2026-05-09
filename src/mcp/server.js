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

server.tool(
  'check_credits',
  'Check remaining DodoArc credits for a subscribed user.',
  {
    userId: z.string().describe('DodoArc user ID')
  },
  async ({ userId }) => {
    const subscription = db.getSubscriptionByUser(userId);
    if (!subscription) {
      return text({ userId, status: 'no_subscription', creditsRemaining: 0 });
    }
    return text({
      userId,
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
    agentName: z.string().optional().describe('Agent name for the usage event'),
    action: z.string().optional().describe('Action label')
  },
  async ({ userId, amount, agentName = 'MCP Agent', action = 'mcp.consume' }) => {
    const result = db.deductCredits(userId, amount);
    if (!result.success) {
      return { ...text({ success: false, error: result.error, userId, amount }), isError: true };
    }
    db.logEvent('credits_consumed_mcp', { userId, amount, agentName, action });
    return text({ success: true, userId, consumed: amount, remaining: result.remaining });
  }
);

server.tool(
  'run_agent',
  'Run the DodoArc demo trading agent, consume 10 credits, and create x402-style Solana settlement receipts.',
  {
    userId: z.string().describe('DodoArc user ID'),
    agentName: z.string().optional().describe('Agent name')
  },
  async ({ userId, agentName = 'MCP Agent' }) => {
    const remaining = db.getRemainingCredits(userId);
    if (remaining < 10) {
      return { ...text({ success: false, error: 'Insufficient credits', remaining }), isError: true };
    }

    const runId = `mcp_run_${crypto.randomUUID().slice(0, 8)}`;
    db.logAgentRun({ run_id: runId, user_id: userId, agent_name: agentName, credits_used: 10, status: 'running' });
    const deduction = db.deductCredits(userId, 10);
    if (!deduction.success) {
      db.completeAgentRun(runId, 'failed', { error: deduction.error });
      return { ...text({ success: false, error: deduction.error }), isError: true };
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
    db.completeAgentRun(runId, 'completed', result);
    db.logEvent('agent_run_completed_mcp', { runId, userId, signal: result.signal, usdcSettled: result.totalUsdcSettled });

    return text({
      success: true,
      runId,
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
    limit: z.number().min(1).max(50).optional().describe('Receipt limit')
  },
  async ({ limit = 10 }) => {
    const receipts = db.getRecentSettlements(limit);
    const totalSettled = receipts.reduce((sum, receipt) => sum + Number(receipt.amount_usdc || 0), 0);
    return text({
      receipts,
      totalSettled,
      network: 'devnet',
      count: receipts.length
    });
  }
);

server.tool(
  'get_dashboard_metrics',
  'Get DodoArc platform metrics for subscriptions, credits, agent runs, and USDC settlement.',
  {},
  async () => {
    const subscriptions = db.getAllSubscriptions();
    const settlements = db.getRecentSettlements(50);
    const runs = db.getRecentRuns(50);
    const mrr = subscriptions
      .filter((sub) => sub.status === 'active')
      .reduce((sum, sub) => sum + Number(db.getPlanById(sub.planId)?.price || 0), 0);
    const totalUsdcSettled = settlements.reduce((sum, receipt) => sum + Number(receipt.amount_usdc || 0), 0);

    return text({
      mrr,
      activeSubscribers: subscriptions.filter((sub) => sub.status === 'active').length,
      totalSubscribers: subscriptions.length,
      totalCreditsUsed: subscriptions.reduce((sum, sub) => sum + Number(sub.credits_used || 0), 0),
      totalCreditsGranted: subscriptions.reduce((sum, sub) => sum + Number(sub.credits_total || 0), 0),
      totalUsdcSettled: Number(totalUsdcSettled.toFixed(6)),
      completedAgentRuns: runs.filter((run) => run.status === 'completed').length,
      network: 'devnet',
      timestamp: new Date().toISOString()
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
