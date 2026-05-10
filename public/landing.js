const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (!entry.isIntersecting) return;
    setTimeout(() => {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }, index * 80);
  });
}, { threshold: 0.05 });

document.querySelectorAll('.step-card, .feature-card, .plan-card').forEach((element) => {
  element.style.opacity = '0';
  element.style.transform = 'translateY(16px)';
  element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(element);
});

document.querySelectorAll('.plan-btn[data-plan-id]').forEach((button) => {
  button.addEventListener('click', async () => {
    const planId = button.dataset.planId;
    if (!planId || planId === 'plan_enterprise') {
      window.location.href = 'mailto:hello@dodoarc.xyz';
      return;
    }

    const email = window.prompt('Enter your email to get started:');
    if (!email || !email.includes('@')) return;

    const originalLabel = button.dataset.label || button.textContent;
    button.textContent = 'Creating checkout...';
    button.disabled = true;

    try {
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, email, name: email.split('@')[0] })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Checkout failed');
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else if (data.success && data.type === 'free') {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      window.alert(error.message || 'Network error. Is the server running?');
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
});

const heroSub = document.querySelector('.hero-sub');
if (heroSub) {
  heroSub.textContent =
    'The programmable spend-control layer for AI agent products. Human users pay in fiat. Agents spend against policy. Every tool call settles on Solana.';
}

const heroStats = document.querySelectorAll('.hero-card-float .float-stat');
if (heroStats.length >= 3) {
  heroStats[0].innerHTML = `
    <div class="float-stat-label">What DodoArc Does</div>
    <div class="float-stat-value" style="font-size:1.1rem;line-height:1.4;">Human pays fiat</div>
    <div class="float-stat-sub">UPI - Card - 150 countries</div>`;
  heroStats[1].innerHTML = `
    <div class="float-stat-label">Agent spends credits</div>
    <div class="float-stat-value" style="font-size:1.1rem;line-height:1.4;">Policy enforced</div>
    <div class="float-stat-sub">Cap - Pause - Approve</div>`;
  heroStats[2].innerHTML = `
    <div class="float-stat-label">Tool calls settle</div>
    <div class="float-stat-value" style="font-size:1.1rem;line-height:1.4;">USDC on Solana</div>
    <div class="float-stat-sub">x402 - verifiable receipt</div>`;
}
