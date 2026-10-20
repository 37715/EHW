/* EHW's future Netgreen lead submission flow.
 * SAFETY: Disabled until Netgreen's API, Turnstile and mail notifications
 * have been deployed and tested. Until then the existing Formspree handler
 * in js/main.js remains the active way of submitting every enquiry.
 * Public Turnstile site key is okay in browser; secret key is NEVER public.
 */
(function (root) {
  'use strict';

  const config = {
    enabled: false,
    endpoint: 'https://netgreen.vercel.app/api/integrations/ehw-leads',
    turnstileSiteKey: '' // Populate only with the PUBLIC Turnstile site key.
  };
  let widgetId = null;

  function enabled() {
    return config.enabled === true
      && /^https:\/\/netgreen\.vercel\.app\/api\/integrations\/ehw-leads$/.test(config.endpoint)
      && Boolean(config.turnstileSiteKey)
      && !!(root.crypto && typeof root.crypto.randomUUID === 'function');
  }

  function loadTurnstile(callback) {
    if (root.turnstile && typeof root.turnstile.render === 'function') {
      callback();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = callback;
    script.onerror = function () { console.error('EHW spam verification unavailable'); };
    document.head.appendChild(script);
  }

  function savedAttribution() {
    const keys = ['utm_source', 'utm_campaign'];
    const params = new URLSearchParams(root.location.search);
    const result = {};
    for (const key of keys) {
      const incoming = params.get(key);
      if (incoming) {
        try { sessionStorage.setItem('ehw_' + key, incoming.slice(0, 100)); } catch (_) {}
      }
      try { result[key] = sessionStorage.getItem('ehw_' + key) || ''; }
      catch (_) { result[key] = incoming || ''; }
    }
    return result;
  }

  function init(form, button) {
    if (!enabled() || !form || !button) return false;
    const widget = document.createElement('div');
    widget.className = 'ehw-turnstile';
    widget.setAttribute('aria-label', 'Spam prevention verification');
    button.parentNode.insertBefore(widget, button);

    const error = document.createElement('p');
    error.setAttribute('role', 'status');
    error.style.marginTop = '12px';
    error.style.fontSize = '14px';
    button.insertAdjacentElement('afterend', error);

    loadTurnstile(function () {
      if (!root.turnstile || widgetId !== null) return;
      widgetId = root.turnstile.render(widget, {
        sitekey: config.turnstileSiteKey,
        theme: 'auto'
      });
    });

    let submitting = false;
    let requestId = null;
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (submitting) return;
      const responseToken = root.turnstile && widgetId !== null
        ? root.turnstile.getResponse(widgetId) : '';
      if (!responseToken) {
        error.textContent = 'Please complete the verification before sending.';
        return;
      }

      if (!requestId) requestId = root.crypto.randomUUID();
      const original = button.textContent;
      const leadGuard = { fired: false };
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      const attribution = savedAttribution();
      data.requestId = requestId;
      data.turnstileToken = responseToken;
      data.utm_source = attribution.utm_source;
      data.utm_campaign = attribution.utm_campaign;
      data.website = ''; // Honeypot should remain blank unless a bot fills it.
      submitting = true;
      button.disabled = true;
      button.textContent = 'Sending…';
      error.textContent = '';
      try {
        const response = await fetch(config.endpoint, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok || result.accepted !== true) {
          throw new Error(result.error || 'Could not submit the enquiry');
        }
        if (root.EHWAnalytics && typeof root.EHWAnalytics.notifyQuoteSuccess === 'function') {
          root.EHWAnalytics.notifyQuoteSuccess(root.gtag, response, form, leadGuard);
        }
        button.textContent = 'Sent — thank you.';
        form.reset();
        requestId = null;
        setTimeout(function () { button.textContent = original; }, 4000);
      } catch (e) {
        error.textContent = 'Could not send your enquiry. Please try again or phone EHW directly.';
        button.textContent = original;
      } finally {
        submitting = false;
        button.disabled = false;
        if (root.turnstile && widgetId !== null) {
          try { root.turnstile.reset(widgetId); } catch (_) {}
        }
      }
    });
    return true;
  }

  root.EHWNetgreenLeads = { enabled: enabled, init: init };
}(window));
