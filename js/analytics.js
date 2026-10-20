/* ============================================================
   EHW Landscapes — GA4 events, Consent Mode v2
   No names, emails, phone numbers or message text are sent.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.EHWAnalytics = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'ehw_cookie_consent';

  function deniedConsent() {
    return {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    };
  }

  function analyticsGrantedConsent() {
    return {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    };
  }

  function leadEventParams(serviceType) {
    return {
      form_name: 'quote_enquiry',
      service_type: serviceType ? String(serviceType) : 'unspecified'
    };
  }

  function sendGenerateLead(gtagFn, serviceType, guard) {
    if (!guard) guard = { fired: false };
    if (guard.fired) return false;
    if (typeof gtagFn !== 'function') return false;
    guard.fired = true;
    gtagFn('event', 'generate_lead', leadEventParams(serviceType));
    return true;
  }

  function notifyQuoteSuccess(gtagFn, response, form, guard) {
    if (!response || !response.ok) return false;
    var serviceEl = form && form.querySelector ? form.querySelector('#service') : null;
    var serviceType = serviceEl && serviceEl.value;
    return sendGenerateLead(gtagFn, serviceType, guard);
  }

  function sendClickToCall(gtagFn, onSent) {
    if (typeof gtagFn !== 'function') return false;
    var params = { link_type: 'tel', transport_type: 'beacon' };
    if (typeof onSent === 'function') {
      params.event_callback = onSent;
      params.event_timeout = 1000;
    }
    gtagFn('event', 'click_to_call', params);
    return true;
  }

  function telHref(link) {
    if (!link) return '';
    return (link.getAttribute && link.getAttribute('href')) || link.href || '';
  }

  function handleTelClick(gtagFn, link) {
    if (String(telHref(link)).toLowerCase().indexOf('tel:') !== 0) return false;
    return sendClickToCall(gtagFn);
  }

  /* Hold the dialer until gtag has queued the hit. A tel: link otherwise
     leaves the page before click_to_call is sent, so Tag Assistant only
     records a generic link click. */
  function interceptTelClick(gtagFn, event, link, navigate) {
    var href = String(telHref(link));
    if (href.toLowerCase().indexOf('tel:') !== 0) return false;
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return false;
    if (event && typeof event.button === 'number' && event.button !== 0) return false;
    if (event && event.preventDefault) event.preventDefault();

    var started = false;
    function go() {
      if (started) return;
      started = true;
      if (typeof navigate === 'function') navigate(href);
    }

    var timer = setTimeout(go, 1000);
    var sent = sendClickToCall(gtagFn, function () {
      clearTimeout(timer);
      go();
    });
    if (!sent) {
      clearTimeout(timer);
      go();
    }
    return true;
  }

  function readStoredConsent(storage) {
    try {
      var value = storage.getItem(STORAGE_KEY);
      if (value === 'granted' || value === 'denied') return value;
    } catch (e) { /* private mode */ }
    return null;
  }

  function applyConsentChoice(gtagFn, storage, choice) {
    var granted = choice === 'granted';
    var state = granted ? analyticsGrantedConsent() : deniedConsent();
    try { storage.setItem(STORAGE_KEY, granted ? 'granted' : 'denied'); } catch (e) { /* ignore */ }
    if (typeof gtagFn === 'function') {
      gtagFn('consent', 'update', state);
    }
    return state;
  }

  function restoreConsent(gtagFn, storage) {
    var stored = readStoredConsent(storage);
    if (stored === 'granted') {
      applyConsentChoice(gtagFn, storage, 'granted');
      return stored;
    }
    if (stored === 'denied') return stored;
    return null;
  }

  function bindTelClicks(gtagFn, root) {
    if (typeof window !== 'undefined' && window.__ehwTelBound) return;
    if (!root || !root.addEventListener) return;
    root.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
      if (!link) return;
      interceptTelClick(gtagFn, e, link, function (href) {
        if (typeof window !== 'undefined') window.location.href = href;
      });
    }, true);
  }

  function initConsentUi(gtagFn, storage, doc) {
    if (!doc || !doc.body) return;
    if (doc.getElementById && doc.getElementById('cookie-bar')) return;
    var stored = readStoredConsent(storage);

    var bar = doc.createElement('div');
    bar.className = 'cookie-bar';
    bar.id = 'cookie-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-labelledby', 'cookie-bar-copy');
    bar.innerHTML =
      '<p class="cookie-bar-copy" id="cookie-bar-copy">We use analytics to see which pages help people find us. We don\u2019t send names, emails or phone numbers.</p>' +
      '<div class="cookie-bar-actions">' +
        '<button type="button" class="cookie-bar-accept" id="cookie-accept">Accept</button>' +
        '<button type="button" class="cookie-bar-reject" id="cookie-reject">No thanks</button>' +
      '</div>';
    doc.body.appendChild(bar);

    function hideBar() {
      bar.classList.remove('is-visible');
      bar.setAttribute('hidden', '');
    }

    function showBar() {
      bar.removeAttribute('hidden');
      bar.classList.add('is-visible');
    }

    if (!stored) showBar();
    else hideBar();

    bar.querySelector('#cookie-accept').addEventListener('click', function () {
      applyConsentChoice(gtagFn, storage, 'granted');
      hideBar();
    });
    bar.querySelector('#cookie-reject').addEventListener('click', function () {
      applyConsentChoice(gtagFn, storage, 'denied');
      hideBar();
    });

    var footerNav = doc.querySelector('.footer-nav');
    if (footerNav && !doc.getElementById('cookie-settings')) {
      var settings = doc.createElement('button');
      settings.type = 'button';
      settings.id = 'cookie-settings';
      settings.className = 'footer-cookie-btn';
      settings.textContent = 'Cookies';
      settings.addEventListener('click', showBar);
      footerNav.appendChild(settings);
    }
  }

  function init(gtagFn, doc, storage) {
    var gtag = gtagFn || (typeof root.gtag === 'function' ? root.gtag : function () {});
    var documentRef = doc || (typeof document !== 'undefined' ? document : null);
    var store = storage || (typeof localStorage !== 'undefined' ? localStorage : { getItem: function () { return null; }, setItem: function () {} });
    bindTelClicks(gtag, documentRef);
    initConsentUi(gtag, store, documentRef);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { init(); });
    } else {
      init();
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    deniedConsent: deniedConsent,
    leadEventParams: leadEventParams,
    sendGenerateLead: sendGenerateLead,
    notifyQuoteSuccess: notifyQuoteSuccess,
    sendClickToCall: sendClickToCall,
    handleTelClick: handleTelClick,
    interceptTelClick: interceptTelClick,
    readStoredConsent: readStoredConsent,
    applyConsentChoice: applyConsentChoice,
    restoreConsent: restoreConsent,
    init: init
  };
}));
