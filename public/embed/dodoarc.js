(function (window, document) {
  'use strict';

  function getBaseUrl() {
    var scripts = document.querySelectorAll('script[src*="/embed/dodoarc.js"]');
    if (!scripts.length) return window.location.origin;
    return new URL(scripts[scripts.length - 1].src).origin;
  }

  var DODOARC_BASE = getBaseUrl();

  function showError(container, message) {
    var error = container.querySelector('[data-dodoarc-error]');
    if (error) {
      error.textContent = message;
      error.style.display = 'block';
    }
  }

  function closeModal() {
    var existing = document.getElementById('dodoarc-overlay');
    if (existing) existing.remove();
  }

  function openCheckout(opts) {
    opts = opts || {};
    if (!opts.appId) {
      console.error('[DodoArc] appId is required');
      return;
    }

    closeModal();

    var overlay = document.createElement('div');
    overlay.id = 'dodoarc-overlay';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'background:rgba(42,40,32,0.62)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'
    ].join(';');

    var modal = document.createElement('div');
    modal.style.cssText = [
      'background:#F7F3EC',
      'border-radius:16px',
      'padding:24px',
      'width:360px',
      'max-width:calc(100vw - 32px)',
      'box-shadow:0 20px 60px rgba(0,0,0,0.3)',
      'position:relative'
    ].join(';');

    modal.innerHTML = [
      '<button type="button" data-dodoarc-close style="position:absolute;top:12px;right:12px;background:none;border:0;font-size:20px;color:#7A7568;cursor:pointer;">x</button>',
      '<div style="text-align:center;margin-bottom:18px;">',
      '<div style="font-size:11px;color:#6B7C5C;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Powered by DodoArc</div>',
      '<div style="font-size:24px;font-weight:700;color:#2A2820;">Subscribe</div>',
      '<div style="font-size:13px;color:#7A7568;margin-top:4px;">Dodo checkout for AI agent credits</div>',
      '</div>',
      '<input data-dodoarc-email type="email" placeholder="you@example.com" value="' + (opts.email || '') + '" style="width:100%;padding:12px;margin-bottom:10px;border:1px solid #EDE8DE;border-radius:8px;font-size:14px;background:#fff;box-sizing:border-box;outline:none;">',
      '<button type="button" data-dodoarc-pay style="width:100%;padding:12px;background:#4A5840;color:#F7F3EC;border:0;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">' + (opts.buttonText || 'Continue to payment') + '</button>',
      '<div data-dodoarc-error style="display:none;color:#A32D2D;font-size:12px;margin-top:8px;"></div>',
      '<div style="text-align:center;margin-top:14px;font-size:11px;color:#7A7568;">Secured by Dodo Payments</div>'
    ].join('');

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeModal();
    });
    modal.querySelector('[data-dodoarc-close]').addEventListener('click', closeModal);
    modal.querySelector('[data-dodoarc-pay]').addEventListener('click', async function () {
      var button = this;
      var email = modal.querySelector('[data-dodoarc-email]').value.trim();
      if (!email || email.indexOf('@') === -1) {
        showError(modal, 'Enter a valid email address.');
        return;
      }

      button.disabled = true;
      button.textContent = 'Creating checkout...';

      try {
        var response = await fetch(DODOARC_BASE + '/api/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: opts.appId,
            planId: opts.planId || 'plan_pro',
            email: email,
            name: opts.name || ''
          })
        });
        var data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Checkout failed');
        if (data.payment_url) {
          window.open(data.payment_url, '_blank', 'noopener,noreferrer');
        }
        closeModal();
        if (typeof opts.onSuccess === 'function') opts.onSuccess(data);
      } catch (error) {
        showError(modal, error.message || 'Checkout failed. Try again.');
        button.disabled = false;
        button.textContent = opts.buttonText || 'Continue to payment';
        if (typeof opts.onError === 'function') opts.onError(error);
      }
    });
  }

  function renderButton(selector, opts) {
    var target = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!target) {
      console.error('[DodoArc] render target not found');
      return;
    }
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = (opts && opts.buttonText) || 'Subscribe with DodoArc';
    button.style.cssText = [
      'background:#4A5840',
      'color:#F7F3EC',
      'border:0',
      'border-radius:8px',
      'padding:10px 16px',
      'font-weight:700',
      'cursor:pointer'
    ].join(';');
    button.addEventListener('click', function () {
      openCheckout(opts || {});
    });
    target.appendChild(button);
    return button;
  }

  window.DodoArc = {
    checkout: openCheckout,
    renderButton: renderButton
  };
})(window, document);
