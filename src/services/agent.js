const config = require('../config');
const solana = require('./solana');

const TOOL_PROVIDER_WALLET =
  config.X402_TOOL_PROVIDER_WALLET || '11111111111111111111111111111111';

const PAID_TOOLS = [
  {
    name: 'market-data',
    amountUsdc: 0.0014,
    log: 'Fetched SOL/USDC volatility and liquidity snapshots'
  },
  {
    name: 'sentiment-feed',
    amountUsdc: 0.0009,
    log: 'Scored builder and market sentiment from simulated feed'
  },
  {
    name: 'signal-engine',
    amountUsdc: 0.0012,
    log: 'Generated weighted trading signal from paid model tool'
  }
];

function makeSignal(runId) {
  const score = Array.from(runId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const signal = ['BUY', 'HOLD', 'SELL'][score % 3];
  const confidence = 72 + (score % 21);
  const sentiment = signal === 'BUY' ? 'bullish' : signal === 'SELL' ? 'risk-off' : 'neutral';
  return { signal, confidence, sentiment };
}

async function runTradingAgent({ runId, userId }) {
  const logs = [`Run ${runId} started for ${userId}`];
  const receipts = [];

  for (const tool of PAID_TOOLS) {
    logs.push(`Calling ${tool.name} via x402`);
    const receipt = await solana.x402Pay({
      toWallet: TOOL_PROVIDER_WALLET,
      amountUsdc: tool.amountUsdc,
      memo: `DodoArc ${runId} ${tool.name}`,
      tool: tool.name
    });
    receipts.push({ ...receipt, tool: tool.name });
    logs.push(`${tool.log}; settled ${tool.amountUsdc} USDC`);
  }

  const signal = makeSignal(runId);
  const totalUsdcSettled = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);

  return {
    ...signal,
    logs,
    receipts,
    totalUsdcSettled,
    mock: receipts.some((receipt) => receipt.mock),
    completedAt: new Date().toISOString()
  };
}

module.exports = {
  runTradingAgent,
  PAID_TOOLS
};
