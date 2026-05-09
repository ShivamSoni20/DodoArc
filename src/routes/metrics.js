const router = require('express').Router();
const db = require('../services/db');

function formatInr(amount) {
  if (amount >= 100000) return `INR ${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `INR ${(amount / 1000).toFixed(1)}K`;
  return `INR ${amount}`;
}

function buildMonthlyRevenue(events) {
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    months.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: date.toLocaleString('en-IN', { month: 'short' }),
      inr: 0,
      usdc: 0
    });
  }

  for (const event of events) {
    if (!['subscription_activated', 'credits_topped_up', 'agent_run_completed', 'agent_run_completed_mcp'].includes(event.type)) {
      continue;
    }

    const date = new Date(event.timestamp);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const target = months.find((month) => month.key === key);
    if (!target) continue;

    if (event.type === 'subscription_activated' || event.type === 'credits_topped_up') {
      target.inr += Number(event.data?.amount || 0) / 100;
    }
    if (event.type === 'agent_run_completed' || event.type === 'agent_run_completed_mcp') {
      target.usdc += Number(event.data?.usdcSettled || 0);
    }
  }

  return months.map(({ key, ...month }) => ({
    ...month,
    inr: Number(month.inr.toFixed(2)),
    usdc: Number(month.usdc.toFixed(6))
  }));
}

router.get('/metrics', (req, res) => {
  const subscriptions = db.getAllSubscriptions();
  const events = db.getRecentEvents(200);
  const settlements = db.getRecentSettlements(100);
  const runs = db.getRecentRuns(100);
  const paidActiveSubscriptions = subscriptions.filter((sub) => {
    const plan = db.getPlanById(sub.planId);
    return sub.status === 'active' && Number(plan?.price || 0) > 0;
  });
  const mrr = paidActiveSubscriptions.reduce((sum, sub) => sum + Number(db.getPlanById(sub.planId)?.price || 0), 0);
  const totalUsdcSettled = settlements.reduce((sum, receipt) => sum + Number(receipt.amount_usdc || 0), 0);

  res.json({
    mrr,
    mrrFormatted: formatInr(mrr),
    activeSubscribers: paidActiveSubscriptions.length,
    totalSubscribers: subscriptions.length,
    totalCreditsUsed: subscriptions.reduce((sum, sub) => sum + Number(sub.credits_used || 0), 0),
    totalCreditsGranted: subscriptions.reduce((sum, sub) => sum + Number(sub.credits_total || 0), 0),
    totalUsdcSettled: Number(totalUsdcSettled.toFixed(6)),
    completedAgentRuns: runs.filter((run) => run.status === 'completed').length,
    monthlyRevenue: buildMonthlyRevenue(events),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
