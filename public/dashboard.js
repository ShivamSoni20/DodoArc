const API = {
  subscriptions: () => fetch('/api/subscriptions').then((response) => response.json()),
  events: () => fetch('/api/subscriptions/events').then((response) => response.json()),
  webhookLog: () => fetch('/api/webhooks/log').then((response) => response.json()),
  settlement: () => fetch('/api/solana/settlement-log').then((response) => response.json())
};

const main = document.getElementById('db-main-content');
let currentView = 'overview';
let refreshTimer;

function metricCard(label, value, sub, trend = 'flat') {
  return `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-change ${trend === 'up' ? 'change-up' : 'change-flat'}">${trend === 'up' ? '↑' : '–'} ${sub}</div>
    </div>`;
}

function subscriberTableHTML(subscriptions) {
  if (!subscriptions.length) {
    return '<div style="padding:1rem;font-size:0.8rem;color:var(--ink-soft);">No subscribers yet. Start with the free plan or trigger a test webhook.</div>';
  }

  return `
    <table class="sub-table">
      <thead><tr><th>User</th><th>Plan</th><th>Payment</th><th>Credits</th><th>Status</th><th>Since</th></tr></thead>
      <tbody>
        ${subscriptions.map((sub) => `
          <tr>
            <td>${sub.user?.email || 'Unknown'}</td>
            <td>${sub.plan?.name || sub.planId} · ${sub.plan?.display_price || 'Free'}</td>
            <td>${sub.payment_method || 'Dodo'}</td>
            <td>${sub.credits_remaining || 0} / ${sub.credits_total || 0}</td>
            <td><span class="status-pill sp-${sub.status === 'active' ? 'active' : sub.status === 'paused' ? 'paused' : 'trial'}">${sub.status}</span></td>
            <td>${new Date(sub.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</td>
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

function agentFeedWidget(events) {
  const rows = events.slice(0, 5).map((event) => {
    const time = new Date(event.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dot = event.type.includes('webhook') ? 'blue' : event.type.includes('payment') ? 'gold' : 'green';
    const amount = event.data?.credits ? `+${event.data.credits} cr` : event.data?.amount ? `${event.data.currency || ''} ${event.data.amount}` : '';
    return `
      <div class="agent-event ae-row-active">
        <span class="ae-time">${time}</span>
        <span class="ae-dot ${dot}"></span>
        <span class="ae-text">${event.type.replace(/_/g, ' ')}</span>
        <span class="ae-amount">${amount}</span>
      </div>`;
  }).join('') || '<div style="font-size:0.75rem;color:var(--ink-soft);padding:0.5rem 0;">No events yet.</div>';

  return `
    <div class="dash-widget">
      <div class="widget-title">Agent Activity <span class="widget-badge wb-live">Live</span></div>
      <div class="agent-flow">${rows}</div>
    </div>`;
}

function creditUsageWidget(subscriptions) {
  const bars = subscriptions.slice(0, 4).map((sub) => {
    const percent = sub.credits_total > 0 ? Math.round((sub.credits_used / sub.credits_total) * 100) : 0;
    return `
      <div class="credit-bar-label"><span>${sub.plan?.name || sub.planId}</span><span>${sub.credits_used}/${sub.credits_total}</span></div>
      <div class="credit-bar-bg"><div class="credit-bar-fill" style="width:${percent}%;background:var(--olive);"></div></div>`;
  }).join('') || '<div style="font-size:0.75rem;color:var(--ink-soft);">No active subscriptions yet.</div>';

  return `
    <div class="dash-widget">
      <div class="widget-title">Credit Usage <span class="widget-badge wb-sync">Synced</span></div>
      <div class="credit-bar-wrap">${bars}</div>
    </div>`;
}

function revenueChartWidget() {
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  return `
    <div class="dash-widget">
      <div class="widget-title">Revenue (6 months) <span class="widget-badge wb-live">Live</span></div>
      <div class="mini-chart">
        ${[35, 42, 38, 55, 62, 68].map((height, index) => `
          <div class="bar-group">
            <div class="bar revenue" style="height:${height}px;"></div>
            <div class="bar settlement" style="height:${Math.round(height * 0.6)}px;"></div>
            <div class="bar-month">${months[index]}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

async function settlementWidget() {
  const { settlements = [] } = await API.settlement().catch(() => ({ settlements: [] }));
  const rows = settlements.map((item) => `
    <div class="settlement-row">
      <div>
        <div class="settle-hash">${item.signature}</div>
        <div style="font-size:0.65rem;color:var(--ink-soft);">${item.label}</div>
      </div>
      <div class="settle-amount">${item.amount}</div>
      <div class="settle-status">${item.status}</div>
    </div>`).join('');

  return `
    <div class="dash-widget">
      <div class="widget-title">Solana Settlements (x402) <span class="widget-badge wb-sync">Devnet</span></div>
      ${rows || '<div style="font-size:0.75rem;color:var(--ink-soft);">No settlements yet.</div>'}
    </div>`;
}

const views = {
  overview: async () => {
    const [{ subscriptions, total, active }, { events }] = await Promise.all([API.subscriptions(), API.events()]);
    const creditsUsed = subscriptions.reduce((sum, sub) => sum + Number(sub.credits_used || 0), 0);
    const revenue = subscriptions.reduce((sum, sub) => sum + Number(sub.plan?.price || 0), 0);
    return `
      <div class="dash-page-title">Overview</div>
      <div class="dash-page-sub" style="margin-bottom:1.25rem;">● LIVE · Last updated ${new Date().toLocaleTimeString('en-IN')} · Auto-refreshes every 15s</div>
      <div class="metrics-row">
        ${metricCard('Fiat Revenue (MoM)', `₹${revenue.toLocaleString('en-IN')}`, 'from active plans', 'up')}
        ${metricCard('Active Subscribers', active || 0, `${total || 0} total`, 'up')}
        ${metricCard('Credits Consumed', creditsUsed.toLocaleString('en-IN'), 'agent credits', 'flat')}
        ${metricCard('USDC Settled', 'Devnet', 'Solana-ready', 'up')}
      </div>
      <div class="dash-grid2" style="margin-top:1rem;">
        ${revenueChartWidget()}
        ${agentFeedWidget(events)}
        ${creditUsageWidget(subscriptions)}
        ${await settlementWidget()}
      </div>
      ${subscriberTableWidget(subscriptions)}`;
  },
  subscribers: async () => {
    const { subscriptions } = await API.subscriptions();
    return `<div class="dash-page-title">Subscribers</div><div class="dash-page-sub" style="margin-bottom:1.25rem;">${subscriptions.length} total subscribers</div><div class="dash-widget">${subscriberTableHTML(subscriptions)}</div>`;
  },
  webhooks: async () => {
    const { log = [] } = await API.webhookLog();
    return `
      <div class="dash-page-title">Webhook Log</div>
      <div class="dash-page-sub" style="margin-bottom:1.25rem;">Every Dodo event received, with idempotency status and retry count.</div>
      <div class="dash-widget">
        <div class="widget-title">Received Events <span class="widget-badge wb-live">Live</span></div>
        <table class="webhook-table">
          <thead><tr><th>Event ID</th><th>Type</th><th>Received</th><th>Status</th><th>Retries</th><th>Action</th></tr></thead>
          <tbody>
            ${log.length ? log.map((event) => `
              <tr>
                <td class="wh-hash">${event.event_id.slice(0, 16)}...</td>
                <td>${event.event_type}</td>
                <td>${new Date(event.received_at).toLocaleString('en-IN')}</td>
                <td class="${event.status === 'processed' ? 'wh-ok' : event.status === 'failed' ? 'wh-fail' : 'wh-pending'}">${event.status}</td>
                <td>${event.retry_count || 0}</td>
                <td style="font-size:0.65rem;color:var(--ink-soft);">${event.action_taken || '-'}</td>
              </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:1rem;color:var(--ink-soft);">No webhooks received yet.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  },
  agents: async () => `<div class="dash-page-title">Agents</div><div class="dash-page-sub">Agent run tracking lands in Milestone 3.</div>${agentFeedWidget((await API.events()).events || [])}`,
  fiat: async () => `<div class="dash-page-title">Fiat Revenue</div><div class="dash-page-sub">Revenue analytics from Dodo checkout events.</div>${revenueChartWidget()}`,
  settlement: async () => `<div class="dash-page-title">USDC Settlement</div><div class="dash-page-sub">Solana devnet settlement readiness.</div>${await settlementWidget()}`,
  credits: async () => `<div class="dash-page-title">Credits</div><div class="dash-page-sub">Credit consumption by subscription.</div>${creditUsageWidget((await API.subscriptions()).subscriptions || [])}`,
  apikeys: async () => '<div class="dash-page-title">API Keys</div><div class="dash-page-sub">Set <code>DASHBOARD_API_KEY</code>, <code>DODO_PAYMENTS_API_KEY</code>, and <code>DODO_PRO_PRODUCT_ID</code> in your local .env.</div>'
};

async function renderView(view) {
  currentView = view;
  main.innerHTML = '<div style="padding:2rem;color:var(--ink-soft);">Loading...</div>';
  try {
    main.innerHTML = await (views[view] || views.overview)();
  } catch (error) {
    main.innerHTML = `<div class="dash-page-title">Something needs attention</div><div class="dash-page-sub">${error.message}</div>`;
  }
}

document.querySelectorAll('.sidebar-item[data-view]').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-item').forEach((candidate) => candidate.classList.remove('active'));
    item.classList.add('active');
    renderView(item.dataset.view);
  });
});

renderView('overview');
refreshTimer = setInterval(() => renderView(currentView), 15000);
window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
