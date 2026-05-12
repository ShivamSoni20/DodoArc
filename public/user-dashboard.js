(function () {
  const heroTitle = document.getElementById('hero-title');
  const heroCopy = document.getElementById('hero-copy');
  const planCount = document.getElementById('plan-count');
  const planSummary = document.getElementById('plan-summary');
  const creditsRemaining = document.getElementById('credits-remaining');
  const creditsUsed = document.getElementById('credits-used');
  const table = document.getElementById('subscriptions-table');

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-IN');
  }

  function renderSubscriptions(subscriptions) {
    if (!subscriptions.length) {
      table.innerHTML = '<div class="empty">No subscriptions linked to this login yet. Complete checkout with this email, then refresh.</div>';
      return;
    }

    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Status</th>
            <th>Credits</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          ${subscriptions.map((sub) => `
            <tr>
              <td>${sub.plan?.name || sub.planId}</td>
              <td>${sub.status}</td>
              <td>${formatNumber(sub.creditsRemaining)} / ${formatNumber(sub.credits_total)}</td>
              <td>${new Date(sub.updated_at || sub.created_at).toLocaleString('en-IN')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async function loadProfile() {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load user access');

    const subscriptions = data.subscriptions || [];
    const active = subscriptions.filter((sub) => sub.status === 'active');
    const remaining = subscriptions.reduce((sum, sub) => sum + Number(sub.creditsRemaining || 0), 0);
    const used = subscriptions.reduce((sum, sub) => sum + Number(sub.credits_used || 0), 0);

    heroTitle.textContent = `Welcome, ${data.account.name || data.account.email}`;
    heroCopy.textContent = 'This page shows the plans, credits, and access currently linked to your login.';
    planCount.textContent = String(active.length);
    planSummary.textContent = active.length
      ? active.map((sub) => `${sub.plan?.name || sub.planId}`).join(', ')
      : 'No active plans yet.';
    creditsRemaining.textContent = formatNumber(remaining);
    creditsUsed.textContent = formatNumber(used);
    renderSubscriptions(subscriptions);
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('dodoarc_api_key');
    window.location.href = '/login?role=user';
  });

  loadProfile().catch((error) => {
    heroTitle.textContent = 'Unable to load access';
    heroCopy.textContent = error.message;
    table.innerHTML = '<div class="empty">Try logging in again with the same email used for checkout.</div>';
  });
})();
