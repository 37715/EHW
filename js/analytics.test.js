'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var analytics = require('./analytics.js');

function mockGtag() {
  var calls = [];
  function gtag() {
    calls.push(Array.prototype.slice.call(arguments));
  }
  gtag.calls = calls;
  return gtag;
}

function mockStorage(initial) {
  var data = Object.assign({}, initial || {});
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem: function (key, value) { data[key] = String(value); },
    removeItem: function (key) { delete data[key]; },
    _data: data
  };
}

test('lead params use quote_enquiry and fall back to unspecified', function () {
  assert.deepEqual(analytics.leadEventParams('hedge-cutting'), {
    form_name: 'quote_enquiry',
    service_type: 'hedge-cutting'
  });
  assert.deepEqual(analytics.leadEventParams(''), {
    form_name: 'quote_enquiry',
    service_type: 'unspecified'
  });
  assert.deepEqual(analytics.leadEventParams(null), {
    form_name: 'quote_enquiry',
    service_type: 'unspecified'
  });
});

test('lead params never include personal fields', function () {
  var params = analytics.leadEventParams('lawn-mowing');
  ['name', 'email', 'phone', 'message', 'user_id', 'user_data'].forEach(function (key) {
    assert.equal(key in params, false);
  });
  assert.equal(Object.keys(params).sort().join(','), 'form_name,service_type');
});

test('generate_lead fires once per success guard and not again', function () {
  var gtag = mockGtag();
  var guard = { fired: false };

  assert.equal(analytics.sendGenerateLead(gtag, 'fencing', guard), true);
  assert.equal(analytics.sendGenerateLead(gtag, 'fencing', guard), false);
  assert.equal(gtag.calls.length, 1);
  assert.deepEqual(gtag.calls[0], [
    'event',
    'generate_lead',
    { form_name: 'quote_enquiry', service_type: 'fencing' }
  ]);
});

test('a new successful enquiry can fire generate_lead again', function () {
  var gtag = mockGtag();
  analytics.sendGenerateLead(gtag, 'mulching', { fired: false });
  analytics.sendGenerateLead(gtag, 'gardening', { fired: false });
  assert.equal(gtag.calls.length, 2);
  assert.equal(gtag.calls[1][2].service_type, 'gardening');
});

test('failed or invalid submissions do not send generate_lead', function () {
  var gtag = mockGtag();
  assert.equal(analytics.notifyQuoteSuccess(gtag, { ok: false }, { querySelector: function () { return { value: 'hedge-cutting' }; } }, { fired: false }), false);
  assert.equal(analytics.notifyQuoteSuccess(gtag, { ok: true }, { querySelector: function () { return { value: 'hedge-cutting' }; } }, { fired: false }), true);
  assert.equal(gtag.calls.length, 1);
});

test('quote success reads only the service field', function () {
  var gtag = mockGtag();
  var queried = [];
  var form = {
    querySelector: function (sel) {
      queried.push(sel);
      if (sel === '#service') return { value: 'other' };
      return { value: 'should-not-be-read@example.com' };
    }
  };
  analytics.notifyQuoteSuccess(gtag, { ok: true }, form, { fired: false });
  assert.deepEqual(queried, ['#service']);
  assert.equal(gtag.calls[0][2].service_type, 'other');
});

test('click_to_call does not send telephone numbers', function () {
  var gtag = mockGtag();
  analytics.sendClickToCall(gtag, 'tel:+447469237953');
  assert.equal(gtag.calls.length, 1);
  assert.equal(gtag.calls[0][0], 'event');
  assert.equal(gtag.calls[0][1], 'click_to_call');
  var payload = JSON.stringify(gtag.calls[0][2] || {});
  assert.equal(payload.indexOf('7469'), -1);
  assert.equal(payload.indexOf('tel:'), -1);
});

test('tel click handler ignores non-phone links', function () {
  var gtag = mockGtag();
  assert.equal(analytics.handleTelClick(gtag, { href: '#contact' }), false);
  assert.equal(analytics.handleTelClick(gtag, { href: '/hedge-cutting' }), false);
  assert.equal(analytics.handleTelClick(gtag, { href: 'tel:+447469237953' }), true);
  assert.equal(gtag.calls.length, 1);
});

test('phone click waits for the hit before opening the dialer', function () {
  var gtag = mockGtag();
  var navigated = [];
  var event = { defaultPrevented: false, button: 0, preventDefault: function () { this.defaultPrevented = true; } };
  var link = { getAttribute: function () { return 'tel:+447469237953'; } };

  assert.equal(analytics.interceptTelClick(gtag, event, link, function (href) { navigated.push(href); }), true);
  assert.equal(event.defaultPrevented, true);
  assert.equal(navigated.length, 0);
  assert.equal(gtag.calls.length, 1);
  assert.equal(gtag.calls[0][1], 'click_to_call');
  assert.equal(gtag.calls[0][2].transport_type, 'beacon');
  assert.equal(JSON.stringify(gtag.calls[0][2]).indexOf('7469'), -1);

  gtag.calls[0][2].event_callback();
  gtag.calls[0][2].event_callback();
  assert.deepEqual(navigated, ['tel:+447469237953']);
});

test('consent defaults are denied and never auto-granted', function () {
  var defaults = analytics.deniedConsent();
  assert.equal(defaults.ad_storage, 'denied');
  assert.equal(defaults.ad_user_data, 'denied');
  assert.equal(defaults.ad_personalization, 'denied');
  assert.equal(defaults.analytics_storage, 'denied');
  assert.equal(analytics.readStoredConsent(mockStorage()), null);
});

test('accepting cookies grants analytics only', function () {
  var gtag = mockGtag();
  var storage = mockStorage();
  analytics.applyConsentChoice(gtag, storage, 'granted');
  assert.equal(storage.getItem(analytics.STORAGE_KEY), 'granted');
  var update = gtag.calls[0];
  assert.equal(update[0], 'consent');
  assert.equal(update[1], 'update');
  assert.equal(update[2].analytics_storage, 'granted');
  assert.equal(update[2].ad_storage, 'denied');
  assert.equal(update[2].ad_user_data, 'denied');
  assert.equal(update[2].ad_personalization, 'denied');
});

test('rejecting cookies keeps analytics denied', function () {
  var gtag = mockGtag();
  var storage = mockStorage();
  analytics.applyConsentChoice(gtag, storage, 'denied');
  assert.equal(storage.getItem(analytics.STORAGE_KEY), 'denied');
  assert.equal(gtag.calls[0][2].analytics_storage, 'denied');
});

test('stored consent is restored without granting by default', function () {
  var gtag = mockGtag();
  analytics.restoreConsent(gtag, mockStorage());
  assert.equal(gtag.calls.length, 0);

  analytics.restoreConsent(gtag, mockStorage({ ehw_cookie_consent: 'granted' }));
  assert.equal(gtag.calls[0][2].analytics_storage, 'granted');
});
