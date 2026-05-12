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
        const next = new URLSearchParams({
          role: 'user',
          mode: 'signup',
          email
        });
        window.location.href = `/login?${next.toString()}`;
      }
    } catch (error) {
      window.alert(error.message || 'Network error. Is the server running?');
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });
});

const heroStats = document.querySelectorAll('.hero-card-float .float-stat');
if (heroStats.length >= 3) {
  heroStats[0].innerHTML = `
    <div class="float-stat-label">Customer pays in fiat</div>
    <div class="float-stat-value" style="font-size:1.1rem;line-height:1.4;">Dodo checkout</div>
    <div class="float-stat-sub">UPI &middot; Card &middot; 150 countries</div>`;
  heroStats[1].innerHTML = `
    <div class="float-stat-label">Your backend checks spend</div>
    <div class="float-stat-value" style="font-size:1.1rem;line-height:1.4;">Policy enforced</div>
    <div class="float-stat-sub">Cap &middot; Pause &middot; Approve</div>`;
  heroStats[2].innerHTML = `
    <div class="float-stat-label">Tool calls settle</div>
    <div class="float-stat-value" style="font-size:1.1rem;line-height:1.4;">USDC on Solana</div>
    <div class="float-stat-sub">x402 &middot; verifiable receipt</div>`;
}
