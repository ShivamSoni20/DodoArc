(function () {
  const state = {
    mode: 'login',
    role: 'founder'
  };

  const form = document.getElementById('auth-form');
  const title = document.getElementById('auth-title');
  const copy = document.getElementById('auth-copy');
  const message = document.getElementById('auth-message');
  const submit = document.getElementById('submit-btn');
  const roleHint = document.getElementById('role-hint');
  const banner = document.getElementById('login-banner');
  const nameField = document.getElementById('name-field');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function applyPrefill() {
    const search = params();
    const mode = search.get('mode');
    const email = search.get('email');
    if (mode === 'signup' || mode === 'login') state.mode = mode;
    if (email) emailInput.value = email;
    if (search.get('plan')) {
      banner.style.display = 'block';
      banner.textContent = 'Payment completed. Log in to the founder dashboard to inspect the subscriber, credits, and webhook state.';
    }
  }

  function render() {
    document.querySelectorAll('#mode-toggle button').forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === state.mode);
    });
    const isSignup = state.mode === 'signup';
    nameField.style.display = isSignup ? 'block' : 'none';
    nameInput.required = isSignup;

    title.textContent = isSignup ? 'Create account' : 'Login';
    submit.textContent = `${isSignup ? 'Create' : 'Login as'} founder`;
    roleHint.textContent = 'Founder access opens the operator dashboard and app integration controls.';
    copy.textContent = 'Founders keep their own app and use DodoArc for credits, policies, subscribers, and settlement traces.';
  }

  async function submitAuth(event) {
    event.preventDefault();
    message.textContent = '';
    message.className = 'message';
    submit.disabled = true;
    submit.textContent = 'Working...';

    try {
      const payload = {
        role: 'founder',
        email: emailInput.value.trim(),
        password: passwordInput.value
      };
      if (state.mode === 'signup') payload.name = nameInput.value.trim();

      const response = await fetch(`/api/auth/${state.mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      if (data.apiKey) {
        sessionStorage.setItem('dodoarc_api_key', data.apiKey);
      } else {
        sessionStorage.removeItem('dodoarc_api_key');
      }

      message.className = 'message ok';
      message.textContent = 'Success. Redirecting...';
      const next = params().get('next');
      window.location.href = next || data.redirectTo || '/dashboard';
    } catch (error) {
      message.className = 'message error';
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
      render();
    }
  }

  document.querySelectorAll('#mode-toggle button').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      render();
    });
  });

  form.addEventListener('submit', submitAuth);
  applyPrefill();
  render();
})();
