'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');

function page(file) {
  return fs.readFileSync(file, 'utf8');
}

var landing = [
  'commercial-grounds-maintenance.html',
  'garden-fencing.html'
];

test('each landing page has one Google tag and posts to Formspree', function () {
  landing.forEach(function (file) {
    var html = page(file);
    var tags = html.match(/googletagmanager\.com\/gtag\/js\?id=G-22CTG1LGFH/g) || [];
    assert.equal(tags.length, 1, file);
    assert.equal((html.match(/G-[A-Z0-9]+/g) || []).filter(function (id) { return id !== 'G-22CTG1LGFH'; }).length, 0);
    assert.equal((html.match(/xnjljokj/g) || []).length, 1, file + ' form endpoint');
    assert.equal((html.match(/id="quote-form"/g) || []).length, 1);
    assert.equal((html.match(/id="service"/g) || []).length, 1);
    assert.ok((html.match(/href="tel:\+447469237953"/g) || []).length >= 2, file);
    assert.equal(html.indexOf('LocalBusiness'), -1, file + ' should not repeat the business schema');
    assert.equal(html.indexOf('js/analytics.js') !== -1, true);
    assert.equal(html.indexOf('js/main.js') !== -1, true);
  });
});

test('commercial page headline, canonical and survey fields', function () {
  var html = page('commercial-grounds-maintenance.html');
  assert.equal(html.indexOf('https://ehwlandscapes.com/commercial-grounds-maintenance') !== -1, true);
  assert.equal(html.indexOf('>Commercial Grounds Maintenance in Hampshire<') !== -1, true);
  ['organisation', 'location', 'site_type', 'message'].forEach(function (name) {
    assert.equal(html.indexOf('name="' + name + '"') !== -1, true, name);
  });
  assert.equal(html.indexOf('Request a Site Survey') !== -1, true);
});

test('fencing page uses the quote form with fencing selected', function () {
  var html = page('garden-fencing.html');
  assert.equal(html.indexOf('https://ehwlandscapes.com/garden-fencing') !== -1, true);
  assert.equal(html.indexOf('Request a Fencing Quote') !== -1, true);
  assert.equal(html.indexOf('value="fencing" selected') !== -1, true);
  assert.equal(html.indexOf('fence-replacement-before.jpg') !== -1, true);
  assert.equal(html.indexOf('fence-replacement-after.jpg') !== -1, true);
});

test('sitemap lists both new pages once', function () {
  var xml = page('sitemap.xml');
  assert.equal((xml.match(/commercial-grounds-maintenance/g) || []).length, 1);
  assert.equal((xml.match(/garden-fencing/g) || []).length, 1);
});
