let connectedWallet = null;
let currentView = 'overview';
let refreshTimer;

const main = document.getElementById('db-main-content');

const API = {
  subscriptions: () => getJson('/api/subscriptions'),
  events: () => getJson('/api/subscriptions/events'),
  credits: (id) => getJson(`/api/credits/${id}`),
  webhookLog: () => getJson('/api/webhooks/log'),
  settlement: () => getJson('/api/solana/settlement-log'),
  agentRuns: () => getJson('/api/agent/runs'),
  walletStatus: () => getJson('/api/solana/wallet-status'),
  plans: () => getJson('/api/plans'),
  runAgent: (userId) => getJson('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, agentName: 'Trading Signal Agent' })
  })
};

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${url}`);
  return data;
}

async function connectWallet() {
  const provider = window.phantom?.solana;
  if (!provider?.isPhantom) {
    if (window.confirm('Phantom wallet not found. Use demo wallet mode for the hackathon preview?')) {
      useDemoWallet();
    }
    return;
  }

  try {
    const response = await provider.connect();
    await setWalletConnected(response.publicKey.toString(), false);
  } catch (error) {
    showToast(`Wallet connection failed: ${error.message}`);
  }
}

function useDemoWallet() {
  setWalletConnected('DodoArc1111111111111111111111111111111111111', true);
}

async function setWalletConnected(pubkey, isDemo = false) {
  connectedWallet = pubkey;
  const connectButton = document.getElementById('wallet-connect-btn');
  const connectedElement = document.getElementById('wallet-connected');
  const address = document.getElementById('wallet-address');

  if (connectButton) connectButton.style.display = 'none';
  if (connectedElement) connectedElement.style.display = 'flex';
  if (address) address.textContent = `${isDemo ? '(demo) ' : ''}${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;

  sessionStorage.setItem('dodoarc_wallet', pubkey);
  sessionStorage.setItem('dodoarc_wallet_demo', isDemo ? '1' : '0');
  await fetch('/api/solana/connect-wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: pubkey, demo: isDemo })
  }).catch(() => {});
}

function disconnectWallet() {
  connectedWallet = null;
  sessionStorage.removeItem('dodoarc_wallet');
  sessionStorage.removeItem('dodoarc_wallet_demo');
  document.getElementById('wallet-connect-btn').style.display = 'flex';
  document.getElementById('wallet-connected').style.display = 'none';
  window.phantom?.solana?.disconnect?.();
}

function restoreWalletState() {
  const saved = sessionStorage.getItem('dodoarc_wallet');
  const isDemo = sessionStorage.getItem('dodoarc_wallet_demo') === '1';
  if (saved) setWalletConnected(saved, isDemo);
}

async function tryAutoConnect() {
  try {
    const provider = window.phantom?.solana;
    if (provider?.isPhantom) {
      const response = await provider.connect({ onlyIfTrusted: true });
      await setWalletConnected(response.publicKey.toString(), false);
    }
  } catch {}
}

function metricCard(label, value, sub, trend = 'flat') {
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-change ${trend === 'up' ? 'change-up' : 'change-flat'}">${trend === 'up' ? 'up' : '-'} ${sub}</div>
    </div>`;
}

function subscriberTableHTML(subscriptions) {
  if (!subscriptions.length) {
    return emptyState('No subscribers yet. Complete or replay a Dodo test checkout.');
  }

  return `
    <table class="sub-table">
      <thead><tr><th>User</th><th>Plan</th><th>Payment</th><th>Credits</th><th>Status</th><th>Since</th></tr></thead>
      <tbody>
        ${subscriptions.map((sub) => `
          <tr>
            <td>${escapeHtml(sub.user?.email || 'Unknown')}</td>
            <td>${escapeHtml(sub.plan?.name || sub.planId)} - ${escapeHtml(sub.plan?.display_price || 'Free')}</td>
            <td>${escapeHtml(sub.payment_method || 'Dodo')}</td>
            <td>${Number(sub.credits_remaining || 0).toLocaleString('en-IN')} / ${Number(sub.credits_total || 0).toLocaleString('en-IN')}</td>
            <td><span class="status-pill ${statusClass(sub.status)}">${escapeHtml(sub.status)}</span></td>
            <td>${formatDate(sub.created_at)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function subscriberTableWidget(subscriptions) {
  return `
    <div class="dash-widget" style="margin-top:1rem;">
      <div class="widget-title">Recent Subscribers <span style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-soft);">${subscriptions.length} total</span></div>
      ${subscriberTableHTML(subscriptions)}
    </div>`;
}

function agentFeedWidget(webhooks) {
  const rows = webhooks.slice(0, 5).map((event) => {
    const details = webhookDetails(event);
    const time = new Date(details.occurredAt || event.processed_at || event.received_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dot = event.status === 'processed' ? 'green' : event.status === 'failed' ? 'gold' : 'blue';
    return `
      <div class="agent-event ae-row-active">
        <span class="ae-time">${time}</span>
        <span class="ae-dot ${dot}"></span>
        <span class="ae-text">${escapeHtml(details.eventType || event.event_type || 'webhook event')}</span>
        <span class="ae-amount">${escapeHtml(details.amountDisplay || details.customerEmail || '')}</span>
      </div>`;
  }).join('');

  return `
    <div class="dash-widget">
      <div class="widget-title">Live Webhook Events <span class="widget-badge wb-live">Dodo</span></div>
      <div class="agent-flow">${rows || emptyState('No Dodo webhooks yet. Complete or replay a checkout to populate this feed.')}</div>
    </div>`;
}

function creditUsageWidget(subscriptions) {
  const bars = subscriptions.slice(0, 4).map((sub) => {
    const percent = sub.credits_total > 0 ? Math.min(100, Math.round((sub.credits_used / sub.credits_total) * 100)) : 0;
    return `
      <div class="credit-bar-label"><span>${escapeHtml(sub.user?.email || sub.plan?.name || sub.planId)}</span><span>${sub.credits_used}/${sub.credits_total}</span></div>
      <div class="credit-bar-bg"><div class="credit-bar-fill" style="width:${percent}%;background:var(--olive);"></div></div>`;
  }).join('');

  return `
    <div class="dash-widget">
      <div class="widget-title">Credit Usage <span class="widget-badge wb-sync">SQLite</span></div>
      <div class="credit-bar-wrap">${bars || emptyState('No credit usage yet. Run an agent to consume credits.')}</div>
    </div>`;
}

function revenueChartWidget(subscriptions = []) {
  const active = subscriptions.filter((sub) => sub.status === 'active');
  const monthlyRevenue = active.reduce((sum, sub) => sum + Number(sub.plan?.price || 0), 0);
  const bars = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => {
    const height = index === 4 && monthlyRevenue ? 68 : Math.max(10, 22 + index * 5);
    return `
      <div class="bar-group">
        <div class="bar revenue" style="height:${height}px;" title="INR ${monthlyRevenue}"></div>
        <div class="bar settlement" style="height:${Math.max(8, height - 18)}px;" title="x402 settlement readiness"></div>
        <div class="bar-month">${month}</div>
      </div>`;
  }).join('');

  return `<div class="dash-widget">
    <div class="widget-title">Revenue Readiness <span class="widget-badge wb-sync">Dodo</span></div>
    <div class="mini-chart">${bars}</div>
  </div>`;
}

function settlementWidgetLive(receipts = [], totalSettled = null) {
  const total = totalSettled ?? receipts.reduce((sum, item) => sum + Number(item.amountUsdc || 0), 0);
  const rows = receipts.slice(0, 4).map((item) => `
    <div class="settlement-row">
      <div>
        <a class="settle-hash" href="${item.explorer}" target="_blank" rel="noreferrer">${escapeHtml(String(item.signature || '').slice(0, 10))}...</a>
        <div style="font-size:0.65rem;color:var(--ink-soft);">${escapeHtml(item.tool || 'tool')} - ${formatTime(item.timestamp)}</div>
      </div>
      <div class="settle-amount">${Number(item.amountUsdc || 0).toFixed(4)} USDC</div>
      <div class="settle-status">${item.mock ? 'mock' : 'devnet'}</div>
    </div>`).join('');

  return `
    <div class="dash-widget">
      <div class="widget-title">Solana Settlements (x402) <span class="widget-badge wb-sync">Devnet</span></div>
      ${rows || emptyState('No settlements yet. Run an agent to trigger x402-style receipts.')}
      ${total > 0 ? `
        <div style="margin-top:10px;padding:6px 8px;background:var(--olive-mist);border-radius:var(--r-sm);display:flex;justify-content:space-between;">
          <span style="font-size:0.7rem;color:var(--olive-dark);font-weight:500;">Total settled</span>
          <span style="font-family:'DM Mono',monospace;font-size:0.75rem;color:var(--olive-dark);font-weight:600;">${Number(total).toFixed(4)} USDC</span>
        </div>` : ''}
    </div>`;
}

const views = {
  overview: async () => {
    const [{ subscriptions = [] }, { log = [] }, settlement] = await Promise.all([
      API.subscriptions(),
      API.webhookLog(),
      API.settlement()
    ]);
    const activeSubscribers = subscriptions.filter((sub) => sub.status === 'active').length;
    const creditsUsed = subscriptions.reduce((sum, sub) => sum + Number(sub.credits_used || 0), 0);
    const totalSettled = Number(settlement.totalSettled || 0);
    const mrr = subscriptions
      .filter((sub) => sub.status === 'active')
      .reduce((sum, sub) => sum + Number(sub.plan?.price || 0), 0);

    return `
      <div class="dash-page-title">Overview</div>
      <div class="dash-page-sub" style="margin-bottom:1.25rem;">
        Dodo checkout, credits, agent runs, and x402 settlement receipts in one operating view.
      </div>
      <div class="metrics-row">
        ${metricCard('MRR (Fiat)', `INR ${mrr.toLocaleString('en-IN')}`, 'active paid subscriptions', 'up')}
        ${metricCard('Active Subscribers', activeSubscribers, `${subscriptions.length} total`, 'up')}
        ${metricCard('Credits Consumed', creditsUsed.toLocaleString('en-IN'), 'agent runs', 'flat')}
        ${metricCard('USDC Settled', `$${totalSettled.toFixed(4)}`, 'x402 receipts', 'up')}
      </div>
      <div class="dash-grid2" style="margin-top:1rem;">
        ${revenueChartWidget(subscriptions)}
        ${agentFeedWidget(log)}
        ${creditUsageWidget(subscriptions)}
        ${settlementWidgetLive(settlement.receipts || [], settlement.totalSettled || 0)}
      </div>
      ${subscriberTableWidget(subscriptions)}`;
  },

  subscribers: async () => {
    const { subscriptions = [] } = await API.subscriptions();
    return `<div class="dash-page-title">Subscribers</div><div class="dash-page-sub" style="margin-bottom:1.25rem;">${subscriptions.length} total subscribers</div><div class="dash-widget">${subscriberTableHTML(subscriptions)}</div>`;
  },

  webhooks: async () => {
    const { log = [] } = await API.webhookLog();
    return `
      <div class="dash-page-title">Webhook Log</div>
      <div class="dash-page-sub" style="margin-bottom:1.25rem;">All Dodo webhook events received directly from the webhook endpoint, with idempotency status and payload details.</div>
      <div class="dash-widget">
        <div class="widget-title">Received Events <span class="widget-badge wb-live">${log.length} events</span></div>
        <table class="webhook-table">
          <thead><tr><th>Event ID</th><th>Type</th><th>Customer</th><th>Amount</th><th>Received</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${log.length ? log.map(webhookRow).join('') : '<tr><td colspan="7" style="text-align:center;padding:1rem;color:var(--ink-soft);">No webhooks received yet.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  },

  agents: async () => {
    const [{ runs = [] }, settlement] = await Promise.all([API.agentRuns(), API.settlement()]);
    const receipts = settlement.receipts || [];
    const totalSettled = settlement.totalSettled || 0;
    return `
      <div class="dash-page-title">Agent Runs</div>
      <div class="dash-page-sub" style="margin-bottom:1.25rem;">Each run consumes 10 credits and creates x402-style USDC settlement receipts.</div>
      <div class="dash-widget" style="margin-bottom:1rem;background:var(--olive-mist);border-color:rgba(107,124,92,0.3);">
        <div class="widget-title">Run Demo Agent</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;font-size:0.82rem;color:var(--ink-soft);line-height:1.6;">Trading Signal Agent calls paid market data, sentiment, and signal tools. It costs 10 credits and settles 0.0035 USDC across 3 tool calls.</div>
          <button id="run-agent-btn" onclick="runDemoAgent()" style="background:var(--olive);color:var(--white);border:none;border-radius:100px;padding:0.65rem 1.5rem;font-family:'Instrument Sans',sans-serif;font-size:0.85rem;font-weight:600;cursor:pointer;white-space:nowrap;">Run Agent (10 credits)</button>
        </div>
        <div id="agent-run-output" style="display:none;margin-top:1rem;"></div>
      </div>
      <div class="dash-widget" style="margin-bottom:1rem;">
        <div class="widget-title">x402 Settlement Log <span style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--ink-soft);">${Number(totalSettled).toFixed(4)} USDC total - devnet</span></div>
        ${receipts.length ? `<table class="sub-table"><thead><tr><th>Run</th><th>Tool</th><th>Amount</th><th>Tx</th><th>Type</th></tr></thead><tbody>${receipts.map((receipt) => `<tr><td style="font-family:'DM Mono',monospace;font-size:0.62rem;">${escapeHtml(receipt.agentRunId)}</td><td>${escapeHtml(receipt.tool)}</td><td>${Number(receipt.amountUsdc || 0).toFixed(4)} USDC</td><td><a href="${receipt.explorer}" target="_blank" rel="noreferrer" style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--lavender-dark);">${escapeHtml(String(receipt.signature || '').slice(0, 12))}...</a></td><td><span class="status-pill ${receipt.mock ? 'sp-trial' : 'sp-active'}">${receipt.mock ? 'mock' : 'devnet'}</span></td></tr>`).join('')}</tbody></table>` : emptyState('No settlements yet. Run the demo agent above.')}
      </div>
      <div class="dash-widget">
        <div class="widget-title">Run History</div>
        ${runs.length ? `<table class="sub-table"><thead><tr><th>Run ID</th><th>Agent</th><th>Credits</th><th>Signal</th><th>Status</th><th>Time</th></tr></thead><tbody>${runs.map((run) => `<tr><td style="font-family:'DM Mono',monospace;font-size:0.62rem;">${escapeHtml(run.run_id)}</td><td>${escapeHtml(run.agent_name)}</td><td>-${run.credits_used}</td><td style="font-weight:600;">${escapeHtml(run.result?.signal || '-')}</td><td><span class="status-pill ${statusClass(run.status)}">${escapeHtml(run.status)}</span></td><td>${formatTime(run.created_at)}</td></tr>`).join('')}</tbody></table>` : emptyState('No agent runs yet.')}
      </div>`;
  },

  fiat: async () => {
    const { subscriptions = [] } = await API.subscriptions();
    return `<div class="dash-page-title">Fiat Revenue</div><div class="dash-page-sub">Revenue readiness from active Dodo subscriptions.</div>${revenueChartWidget(subscriptions)}`;
  },
  settlement: async () => {
    const settlement = await API.settlement();
    return `<div class="dash-page-title">USDC Settlement</div><div class="dash-page-sub">Solana devnet settlement readiness.</div>${settlementWidgetLive(settlement.receipts || [], settlement.totalSettled || 0)}`;
  },
  credits: async () => {
    const { subscriptions = [] } = await API.subscriptions();
    return `<div class="dash-page-title">Credits</div><div class="dash-page-sub">Credit consumption by subscription.</div>${creditUsageWidget(subscriptions)}`;
  },
  apikeys: async () => '<div class="dash-page-title">API Keys</div><div class="dash-page-sub">Set DASHBOARD_API_KEY, DODO_PAYMENTS_API_KEY, and DODO_PRO_PRODUCT_ID in your local .env.</div>'
};

async function runDemoAgent() {
  const button = document.getElementById('run-agent-btn');
  const output = document.getElementById('agent-run-output');
  if (button) {
    button.disabled = true;
    button.textContent = 'Running agent...';
  }
  if (output) {
    output.style.display = 'block';
    output.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:var(--ink-soft);line-height:1.8;">Calling paid tools via x402...<br>Writing settlement receipts...</div>';
  }

  try {
    const { subscriptions = [] } = await API.subscriptions();
    const active = subscriptions.find((sub) => sub.status === 'active') || subscriptions[0];
    if (!active?.userId) throw new Error('Complete a Dodo checkout before running the agent.');

    const data = await API.runAgent(active.userId);
    if (!data.success) throw new Error(data.error || 'Agent run failed');
    renderAgentOutput(output, data.result);
    showToast(`Agent run complete - ${data.result.signal} signal, ${data.result.totalUsdcSettled.toFixed(4)} USDC settled`);
    setTimeout(() => renderView(currentView), 900);
    return data;
  } catch (error) {
    if (output) output.innerHTML = `<div style="color:#A32D2D;font-size:0.8rem;">${escapeHtml(error.message)}</div>`;
    showToast(`Agent error: ${error.message}`);
    throw error;
  } finally {
    if (button) {
      button.textContent = 'Run Agent (10 credits)';
      button.disabled = false;
    }
  }
}

async function renderView(view) {
  currentView = view;
  main.innerHTML = '<div class="dash-page-sub">Loading...</div>';
  try {
    main.innerHTML = await (views[view] || views.overview)();
  } catch (error) {
    main.innerHTML = errorState(error.message);
  }

  document.querySelectorAll('.sidebar-item[data-view]').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === currentView);
  });
}

function errorState(message) {
  return `
    <div style="padding:3rem;text-align:center;">
      <div style="font-size:0.9rem;font-weight:600;color:var(--ink);margin-bottom:0.5rem;">Failed to load dashboard</div>
      <div style="font-size:0.78rem;color:var(--ink-soft);margin-bottom:1.5rem;">${escapeHtml(message)}</div>
      <button onclick="renderView('${currentView}')" style="background:var(--olive);color:var(--white);border:none;border-radius:100px;padding:0.5rem 1.25rem;font-size:0.8rem;font-weight:600;cursor:pointer;">Try again</button>
    </div>`;
}

function renderAgentOutput(output, result) {
  if (!output) return;
  output.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div style="background:var(--white);padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--cream-dark);">
        <div style="font-size:0.65rem;color:var(--ink-soft);margin-bottom:4px;">SIGNAL</div>
        <div style="font-size:1.4rem;font-weight:600;color:var(--olive);">${escapeHtml(result.signal)}</div>
        <div style="font-size:0.7rem;color:var(--ink-soft);">${result.confidence}% confidence - ${escapeHtml(result.sentiment)}</div>
      </div>
      <div style="background:var(--white);padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--cream-dark);">
        <div style="font-size:0.65rem;color:var(--ink-soft);margin-bottom:4px;">x402 SETTLED</div>
        <div style="font-size:1.2rem;font-weight:600;color:var(--ink);">${result.totalUsdcSettled.toFixed(4)} USDC</div>
        <div style="font-size:0.7rem;color:var(--ink-soft);">${result.receipts.length} tool calls - ${result.mock ? 'mock' : 'devnet'}</div>
      </div>
    </div>
    <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--ink-soft);line-height:1.9;">${result.logs.map((log) => `<div>${escapeHtml(log)}</div>`).join('')}</div>`;
}

function showToast(message) {
  const existing = document.getElementById('dodoarc-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'dodoarc-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%);
    background:var(--ink); color:var(--cream);
    padding:0.6rem 1.25rem; border-radius:100px;
    font-family:'Instrument Sans',sans-serif; font-size:0.8rem; font-weight:500;
    z-index:999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
    animation:toast-in 0.3s ease; white-space:nowrap;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
  setTimeout(() => toast.remove(), 3500);
}

function emptyState(message) {
  return `<div style="font-size:0.75rem;color:var(--ink-soft);padding:0.75rem 0;">${escapeHtml(message)}</div>`;
}

function statusClass(status) {
  if (status === 'active' || status === 'completed') return 'sp-active';
  if (status === 'paused' || status === 'failed') return 'sp-paused';
  return 'sp-trial';
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function webhookRow(event) {
  const details = webhookDetails(event);
  const statusClassName = event.status === 'processed' ? 'wh-ok' : event.status === 'failed' ? 'wh-fail' : 'wh-pending';
  const paymentLink = details.invoiceUrl
    ? `<a href="${details.invoiceUrl}" target="_blank" rel="noreferrer" style="color:var(--lavender-dark);font-family:'DM Mono',monospace;font-size:0.62rem;">invoice</a>`
    : escapeHtml(details.paymentId || '-');

  return `
    <tr>
      <td>
        <div class="wh-hash">${escapeHtml(String(event.event_id).slice(0, 16))}...</div>
        <div style="font-size:0.58rem;color:var(--ink-soft);">${details.isReal ? 'Dodo live/test' : 'local/test'}</div>
      </td>
      <td>
        <div>${escapeHtml(details.eventType || event.event_type)}</div>
        <div style="font-size:0.6rem;color:var(--ink-soft);">${escapeHtml(details.payloadType || '')}</div>
      </td>
      <td>
        <div>${escapeHtml(details.customerEmail || '-')}</div>
        <div style="font-size:0.6rem;color:var(--ink-soft);">${escapeHtml(details.customerName || '')}</div>
      </td>
      <td>
        <div>${escapeHtml(details.amountDisplay || '-')}</div>
        <div>${paymentLink}</div>
      </td>
      <td>${formatDateTime(event.received_at)}</td>
      <td class="${statusClassName}">${escapeHtml(event.status)}${event.retry_count ? ` (${event.retry_count})` : ''}</td>
      <td style="font-size:0.65rem;color:var(--ink-soft);">${escapeHtml(event.action_taken || '-')}</td>
    </tr>`;
}

function webhookDetails(event) {
  if (event.dodo) return event.dodo;
  const payload = parseWebhookPayload(event);
  const data = payload.data || {};
  const customer = data.customer || {};
  const metadata = data.metadata || {};
  const amount = Number(data.total_amount || data.amount || data.settlement_amount || 0);
  const paymentId = data.payment_id || data.id || data.subscription_id || data.refund_id || data.dispute_id || '';

  return {
    businessId: payload.business_id || data.business_id || null,
    eventType: payload.type || event.event_type,
    payloadType: data.payload_type || null,
    occurredAt: payload.timestamp || event.processed_at || event.received_at,
    paymentId,
    checkoutSessionId: data.checkout_session_id || null,
    invoiceId: data.invoice_id || null,
    invoiceUrl: data.invoice_url || null,
    customerEmail: customer.email || metadata.email || null,
    customerName: customer.name || metadata.name || null,
    amount,
    amountDisplay: amount ? `${data.currency || data.settlement_currency || ''} ${(amount / 100).toFixed(2)}`.trim() : '',
    currency: data.currency || data.settlement_currency || null,
    method: data.payment_method || data.payment_method_type || null,
    status: data.status || event.status,
    isReal: Boolean(payload.business_id && !String(paymentId).startsWith('pay_local_') && !String(paymentId).startsWith('pay_evt_demo_'))
  };
}

function parseWebhookPayload(event) {
  try {
    return JSON.parse(event.raw_body || '{}');
  } catch {
    return {};
  }
}

document.querySelectorAll('.sidebar-item[data-view]').forEach((item) => {
  item.addEventListener('click', () => renderView(item.dataset.view));
});

restoreWalletState();
tryAutoConnect();
renderView('overview');
refreshTimer = setInterval(() => renderView(currentView), 30000);
window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
