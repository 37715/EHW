/* ============================================================
   EHW Landscapes — store.js
   Curated shop powered by Shopify (Buy SDK) behind a custom
   front end. Runs in two modes:

     • PREVIEW MODE  — Shopify not wired in yet. Shows the
       PLACEHOLDER_PRODUCTS below so the page is fully designed
       and clickable. Checkout shows a friendly notice.

     • LIVE MODE     — as soon as you fill in CONFIG.domain +
       CONFIG.storefrontToken (and product IDs) the page fetches
       real products and checkout redirects to Shopify.

   ───────────────────────────────────────────────────────────
   TO GO LIVE (see the checklist Ellis was given):
     1. Shopify admin → Settings → Apps and sales channels →
        Develop apps → Create an app → Storefront API.
        Tick: read products, read/write checkouts.
     2. Paste the "Storefront API access token" + your
        xxx.myshopify.com domain into CONFIG below.
     3. Put your product IDs (or a collection ID) in CONFIG.
        Then PREVIEW MODE switches off automatically.
   ============================================================ */

(function () {
  'use strict';

  /* ========================================================
     CONFIG — fill these in to go live
     ======================================================== */
  var CONFIG = {
    // e.g. 'ehw-landscapes.myshopify.com'  (NOT the public domain)
    domain: '',

    // Storefront API access token (public, read-only — safe in client JS)
    storefrontToken: '',

    // OPTION A — list the exact product IDs you want to feature, in order.
    //   Storefront GIDs look like: 'gid://shopify/Product/123456789'
    // OPTION B — leave productIds empty and set collectionId to show a
    //   whole Shopify collection instead.
    productIds: [],
    collectionId: '' // e.g. 'gid://shopify/Collection/123456789'
  };

  // We're live only once a domain AND token are present.
  var LIVE = Boolean(CONFIG.domain && CONFIG.storefrontToken);

  /* ========================================================
     PLACEHOLDER PRODUCTS (preview mode only)
     Swap freely — these just make the page real before
     Shopify is connected. Images are royalty-free Unsplash.
     ======================================================== */
  var PLACEHOLDER_PRODUCTS = [
    {
      id: 'demo-1',
      title: 'Bypass Secateurs',
      desc: 'Carbon-steel blades, soft-grip handles. The one tool we reach for every single day.',
      price: 18.0,
      compareAt: 24.0,
      image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=70',
      available: true
    },
    {
      id: 'demo-2',
      title: 'Hand Trowel & Fork Set',
      desc: 'Forged stainless set for planting and weeding. Wooden handles, leather hanging loops.',
      price: 22.0,
      compareAt: null,
      image: 'https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=800&q=70',
      available: true
    },
    {
      id: 'demo-3',
      title: 'Waxed Canvas Garden Gloves',
      desc: 'Tough, breathable, and they only get better with use. Sizes M–XL.',
      price: 15.0,
      compareAt: null,
      image: 'https://images.unsplash.com/photo-1599629954294-14df9ec8bc06?auto=format&fit=crop&w=800&q=70',
      available: true
    },
    {
      id: 'demo-4',
      title: 'Watering Can — 5L',
      desc: 'Powder-coated steel with a fine brass rose. Balanced full or empty.',
      price: 28.0,
      compareAt: null,
      image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=70',
      available: true
    },
    {
      id: 'demo-5',
      title: 'Twine & Dibber Kit',
      desc: 'Jute twine on a beechwood holder with a hand-turned dibber. Small, useful, lovely.',
      price: 12.0,
      compareAt: null,
      image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=800&q=70',
      available: true
    },
    {
      id: 'demo-6',
      title: 'Trug Garden Basket',
      desc: 'Recycled rubber trug for cuttings, weeds and harvests. Frost-proof, hose-clean.',
      price: 16.0,
      compareAt: 20.0,
      image: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=800&q=70',
      available: false
    }
  ];

  /* ========================================================
     DOM refs
     ======================================================== */
  var grid = document.getElementById('product-grid');
  var statusEl = document.getElementById('store-status');
  var drawer = document.getElementById('cart-drawer');
  var overlay = document.getElementById('cart-overlay');
  var itemsEl = document.getElementById('cart-items');
  var footEl = document.getElementById('cart-foot');
  var subtotalEl = document.getElementById('cart-subtotal-value');
  var countEl = document.getElementById('cart-count');
  var toggleBtn = document.getElementById('cart-toggle');
  var closeBtn = document.getElementById('cart-close');
  var checkoutBtn = document.getElementById('checkout-btn');

  if (!grid) return; // not the store page

  var CART_KEY = 'ehw-cart-v1';
  var products = []; // normalised product list once loaded
  var cart = loadCart(); // [{ id, variantId, title, image, price, qty }]

  /* ========================================================
     MONEY
     ======================================================== */
  function gbp(n) {
    return '£' + Number(n).toFixed(2);
  }

  /* ========================================================
     CART PERSISTENCE
     ======================================================== */
  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) { /* storage full / disabled — ignore */ }
  }

  /* ========================================================
     STATUS MESSAGES
     ======================================================== */
  function showStatus(html) {
    statusEl.innerHTML = html;
    statusEl.hidden = false;
    grid.hidden = true;
  }

  function showError() {
    showStatus(
      '<p class="store-status-title">The shop is just warming up.</p>' +
      '<p>We couldn’t load our products right now. Please try again shortly — ' +
      'or call us on <a href="tel:+447469237953">07469 237953</a> and we’ll sort you out.</p>'
    );
  }

  /* ========================================================
     PRODUCT RENDERING
     ======================================================== */
  function renderProducts() {
    if (!products.length) {
      showStatus(
        '<p class="store-status-title">Nothing in the shop just yet.</p>' +
        '<p>We’re busy picking the first batch of kit — check back soon.</p>'
      );
      return;
    }

    statusEl.hidden = true;
    grid.hidden = false;
    grid.innerHTML = '';

    products.forEach(function (p) {
      var card = document.createElement('article');
      card.className = 'product-card reveal' + (p.available ? '' : ' sold-out');

      var priceHtml = p.compareAt
        ? '<span class="price-was">' + gbp(p.compareAt) + '</span>' + gbp(p.price)
        : gbp(p.price);

      var badge = '';
      if (!p.available) badge = '<span class="product-badge">Sold out</span>';
      else if (p.compareAt) badge = '<span class="product-badge">Sale</span>';

      card.innerHTML =
        '<div class="product-media">' + badge +
          '<img src="' + p.image + '" alt="' + escapeAttr(p.title) + '" loading="lazy">' +
        '</div>' +
        '<h2 class="product-title">' + escapeHtml(p.title) + '</h2>' +
        '<p class="product-desc">' + escapeHtml(p.desc) + '</p>' +
        '<div class="product-foot">' +
          '<span class="product-price">' + priceHtml + '</span>' +
          '<button class="add-btn" type="button"' + (p.available ? '' : ' disabled') + '>' +
            (p.available ? 'Add to basket' : 'Sold out') +
          '</button>' +
        '</div>';

      if (p.available) {
        card.querySelector('.add-btn').addEventListener('click', function () {
          addToCart(p, this);
        });
      }

      grid.appendChild(card);
    });

    // Let the existing scroll-reveal observer animate the new cards in.
    if (window.IntersectionObserver) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      }, { threshold: 0.1 });
      grid.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });
    } else {
      grid.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  /* ========================================================
     CART OPERATIONS
     ======================================================== */
  function addToCart(p, btn) {
    var line = find(cart, function (l) { return l.id === p.id; });
    if (line) {
      line.qty += 1;
    } else {
      cart.push({
        id: p.id,
        variantId: p.variantId || null,
        title: p.title,
        image: p.image,
        price: p.price,
        qty: 1
      });
    }
    saveCart();
    renderCart();
    updateCount();

    if (btn) {
      var original = btn.textContent;
      btn.textContent = 'Added ✓';
      btn.classList.add('added');
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove('added');
      }, 1100);
    }
    openCart();
  }

  function changeQty(id, delta) {
    var line = find(cart, function (l) { return l.id === id; });
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) {
      cart = cart.filter(function (l) { return l.id !== id; });
    }
    saveCart();
    renderCart();
    updateCount();
  }

  function removeLine(id) {
    cart = cart.filter(function (l) { return l.id !== id; });
    saveCart();
    renderCart();
    updateCount();
  }

  function cartTotal() {
    return cart.reduce(function (sum, l) { return sum + l.price * l.qty; }, 0);
  }

  function cartCount() {
    return cart.reduce(function (sum, l) { return sum + l.qty; }, 0);
  }

  function updateCount() {
    var n = cartCount();
    countEl.textContent = n;
    countEl.classList.toggle('has-items', n > 0);
  }

  function renderCart() {
    if (!cart.length) {
      itemsEl.innerHTML = '<p class="cart-empty">Your basket is empty.<br>Pick something good for the garden.</p>';
      footEl.hidden = true;
      return;
    }

    footEl.hidden = false;
    itemsEl.innerHTML = '';

    cart.forEach(function (l) {
      var row = document.createElement('div');
      row.className = 'cart-line';
      row.innerHTML =
        '<img class="cart-line-img" src="' + l.image + '" alt="' + escapeAttr(l.title) + '">' +
        '<div class="cart-line-info">' +
          '<span class="cart-line-title">' + escapeHtml(l.title) + '</span>' +
          '<span class="cart-line-price">' + gbp(l.price) + ' each</span>' +
          '<div class="qty">' +
            '<button type="button" class="qty-minus" aria-label="Decrease quantity">−</button>' +
            '<span>' + l.qty + '</span>' +
            '<button type="button" class="qty-plus" aria-label="Increase quantity">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="cart-line-end">' +
          '<span class="cart-line-total">' + gbp(l.price * l.qty) + '</span>' +
          '<button type="button" class="cart-remove">Remove</button>' +
        '</div>';

      row.querySelector('.qty-minus').addEventListener('click', function () { changeQty(l.id, -1); });
      row.querySelector('.qty-plus').addEventListener('click', function () { changeQty(l.id, 1); });
      row.querySelector('.cart-remove').addEventListener('click', function () { removeLine(l.id); });

      itemsEl.appendChild(row);
    });

    subtotalEl.textContent = gbp(cartTotal());
  }

  /* ========================================================
     DRAWER OPEN / CLOSE
     ======================================================== */
  function openCart() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    overlay.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
  }
  function closeCart() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    setTimeout(function () { if (!overlay.classList.contains('open')) overlay.hidden = true; }, 350);
  }

  toggleBtn.addEventListener('click', openCart);
  closeBtn.addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeCart();
  });

  /* ========================================================
     CHECKOUT
     ======================================================== */
  checkoutBtn.addEventListener('click', function () {
    if (!cart.length) return;

    if (!LIVE) {
      // Preview mode — no real Shopify yet.
      var note = footEl.querySelector('.cart-preview-note');
      if (!note) {
        note = document.createElement('p');
        note.className = 'cart-preview-note';
        note.innerHTML = 'Preview mode — checkout goes live once the Shopify store is connected.';
        footEl.appendChild(note);
      }
      return;
    }

    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Taking you to checkout…';

    var lineItems = cart
      .filter(function (l) { return l.variantId; })
      .map(function (l) { return { variantId: l.variantId, quantity: l.qty }; });

    shopifyClient().then(function (client) {
      return client.checkout.create().then(function (checkout) {
        return client.checkout.addLineItems(checkout.id, lineItems);
      });
    }).then(function (checkout) {
      window.location.href = checkout.webUrl;
    }).catch(function () {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Checkout';
      alert('Sorry — we couldn’t start the checkout. Please try again, or call 07469 237953.');
    });
  });

  /* ========================================================
     SHOPIFY (live mode) — lazy-load the Buy SDK on demand
     ======================================================== */
  var _clientPromise = null;
  function shopifyClient() {
    if (_clientPromise) return _clientPromise;
    _clientPromise = loadScript('https://sdks.shopifycdn.com/js-buy-sdk/v2/latest/index.umd.min.js')
      .then(function () {
        return window.ShopifyBuy.buildClient({
          domain: CONFIG.domain,
          storefrontAccessToken: CONFIG.storefrontToken
        });
      });
    return _clientPromise;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function normaliseShopifyProduct(p) {
    var variant = p.variants && p.variants[0];
    var img = (p.images && p.images[0] && p.images[0].src) || '';
    var price = variant ? Number(variant.price.amount || variant.price) : 0;
    var compare = variant && variant.compareAtPrice
      ? Number(variant.compareAtPrice.amount || variant.compareAtPrice)
      : null;
    return {
      id: p.id,
      variantId: variant ? variant.id : null,
      title: p.title,
      desc: p.description ? p.description.slice(0, 140) : '',
      price: price,
      compareAt: compare && compare > price ? compare : null,
      image: img,
      available: variant ? variant.available !== false : false
    };
  }

  /* ========================================================
     BOOT
     ======================================================== */
  function boot() {
    updateCount();
    renderCart();

    if (!LIVE) {
      products = PLACEHOLDER_PRODUCTS.map(function (p) {
        return {
          id: p.id, variantId: null, title: p.title, desc: p.desc,
          price: p.price, compareAt: p.compareAt, image: p.image, available: p.available
        };
      });
      renderProducts();
      return;
    }

    // Live: fetch from Shopify
    shopifyClient().then(function (client) {
      if (CONFIG.productIds && CONFIG.productIds.length) {
        return Promise.all(CONFIG.productIds.map(function (id) {
          return client.product.fetch(id);
        }));
      }
      if (CONFIG.collectionId) {
        return client.collection.fetchWithProducts(CONFIG.collectionId, { productsFirst: 24 })
          .then(function (col) { return col.products; });
      }
      return client.product.fetchAll(24);
    }).then(function (raw) {
      products = (raw || []).map(normaliseShopifyProduct);
      renderProducts();
    }).catch(function () {
      showError();
    });
  }

  /* tiny helper (Array.prototype.find is fine, but keep it bullet-proof) */
  function find(arr, fn) {
    for (var i = 0; i < arr.length; i++) { if (fn(arr[i])) return arr[i]; }
    return null;
  }

  boot();
})();
