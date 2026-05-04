(function () {
  const planButtons = [
    { selector: '.btn-starter', planId: 'plan_starter' },
    { selector: '.btn-pro', planId: 'plan_pro' }
  ];

  async function postJSON(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function setMetric(labelText, value) {
    const labels = Array.from(document.querySelectorAll('.metric-label'));
    const label = labels.find((node) => node.textContent.trim().includes(labelText));
    const card = label && label.closest('.metric-card');
    const metric = card && card.querySelector('.metric-value');
    if (metric) metric.textContent = value;
  }

  function statusClass(status) {
    if (status === 'active') return 'sp-active';
    if (status === 'paused' || status === 'on_hold') return 'sp-paused';
    return 'sp-trial';
  }

  function renderSubscriberTable(subscriptions) {
    const tbody = document.querySelector('.sub-table tbody');
    if (!tbody) return;

    if (!subscriptions.length) {
      tbody.innerHTML = '<tr><td colspan="6">No live subscribers yet. Start with the free plan or send a test webhook.</td></tr>';
      return;
    }

    tbody.innerHTML = subscriptions.slice(0, 6).map((sub) => {
      const user = sub.user || {};
      const plan = sub.plan || {};
      const since = new Date(sub.created_at).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric'
      });

      return `
        <tr>
          <td>${user.email || 'Unknown'}</td>
          <td>${plan.name || sub.planId} - ${plan.display_price || 'Free'}</td>
          <td>${sub.payment_method || 'Dodo'}</td>
          <td>${sub.credits_remaining} / ${sub.credits_total}</td>
          <td><span class="status-pill ${statusClass(sub.status)}">${sub.status}</span></td>
          <td>${since}</td>
        </tr>
      `;
    }).join('');
  }

  function renderEvents(events) {
    const feed = document.querySelector('.agent-flow');
    if (!feed || !events.length) return;

    feed.innerHTML = events.slice(0, 5).map((event) => {
      const time = new Date(event.timestamp).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const dot = event.type.includes('payment') || event.type.includes('checkout')
        ? 'gold'
        : event.type.includes('webhook')
          ? 'blue'
          : 'green';
      const amount = event.data?.credits
        ? `+${event.data.credits} cr`
        : event.data?.amount
          ? `${event.data.currency || ''} ${event.data.amount}`
          : '';

      return `
        <div class="agent-event ae-row-active">
          <span class="ae-time">${time}</span>
          <span class="ae-dot ${dot}"></span>
          <span class="ae-text">${event.type.replace(/_/g, ' ')}</span>
          <span class="ae-amount">${amount}</span>
        </div>
      `;
    }).join('');
  }

  async function loadDashboardData() {
    try {
      const [subsResponse, eventsResponse, solanaResponse] = await Promise.all([
        fetch('/api/subscriptions'),
        fetch('/api/subscriptions/events'),
        fetch('/api/solana/settlement-config')
      ]);
      const { subscriptions, active } = await subsResponse.json();
      const { events } = await eventsResponse.json();
      const settlement = await solanaResponse.json();

      const creditsUsed = subscriptions.reduce((sum, sub) => sum + Number(sub.credits_used || 0), 0);
      setMetric('Active Subscribers', String(active || 0));
      setMetric('Credits Consumed', creditsUsed.toLocaleString('en-IN'));

      const settlementWallet = settlement.settlement_wallet ? 'Ready' : 'Devnet';
      setMetric('USDC Settled', settlementWallet);

      renderSubscriberTable(subscriptions);
      renderEvents(events);
    } catch (error) {
      console.warn('Dashboard live data unavailable:', error.message);
    }
  }

  function wireCheckoutButtons() {
    planButtons.forEach(({ selector, planId }) => {
      const button = document.querySelector(selector);
      if (!button) return;

      button.addEventListener('click', async () => {
        const email = window.prompt('Enter your email to start DodoArc:');
        if (!email) return;

        button.disabled = true;
        const original = button.textContent;
        button.textContent = 'Starting...';

        try {
          const data = await postJSON('/api/checkout/create', {
            planId,
            email,
            name: email.split('@')[0]
          });

          if (data.payment_url) {
            window.location.href = data.payment_url;
          } else {
            await loadDashboardData();
            window.location.hash = '#dashboard';
          }
        } catch (error) {
          window.alert(error.message);
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireCheckoutButtons();
    loadDashboardData();
    setInterval(loadDashboardData, 15000);
  });
})();
