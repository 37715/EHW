/* ============================================================
   EHW Landscaping — main.js
   ============================================================ */

(function () {
  'use strict';

  /* --------------------------------------------------------
     1. Navbar — add .scrolled class on scrollY > 20
  -------------------------------------------------------- */
  const navbar = document.getElementById('navbar');

  function handleNavbarScroll() {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  // Run on load in case page is already scrolled
  handleNavbarScroll();
  window.addEventListener('scroll', handleNavbarScroll, { passive: true });

  /* --------------------------------------------------------
     2. Hamburger menu toggle
  -------------------------------------------------------- */
  const hamburger = document.getElementById('hamburger');
  const navMobile = document.getElementById('nav-mobile');

  if (hamburger && navMobile) {
    hamburger.addEventListener('click', function () {
      const isOpen = hamburger.classList.toggle('open');
      navMobile.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close mobile nav when a link is clicked
    navMobile.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.classList.remove('open');
        navMobile.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* --------------------------------------------------------
     3. Scroll reveal — bidirectional IntersectionObserver
        Adds .visible on enter, removes on leave so animations
        replay when scrolling back up (slideshow feel).
  -------------------------------------------------------- */
  var revealElements = document.querySelectorAll('.reveal');

  if (revealElements.length > 0) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          } else {
            entry.target.classList.remove('visible');
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* --------------------------------------------------------
     4. Staggered reveal — bidirectional
        Stagger in on enter, instantly reset on leave so the
        animation fires again next time the group scrolls in.
        Pending timeouts are cancelled on leave to prevent
        ghost reveals mid-scroll.
  -------------------------------------------------------- */
  var staggerGroups = document.querySelectorAll('[data-stagger]');

  if (staggerGroups.length > 0) {
    var staggerObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var items = entry.target.querySelectorAll('[data-stagger-item]');
          var timers = entry.target._staggerTimers || [];

          if (entry.isIntersecting) {
            // Cancel any in-flight timers from a previous half-scroll
            timers.forEach(function (t) { clearTimeout(t); });
            entry.target._staggerTimers = [];

            items.forEach(function (item, index) {
              var t = setTimeout(function () {
                item.classList.add('visible');
              }, index * 110);
              entry.target._staggerTimers.push(t);
            });
          } else {
            // Cancel pending timers then instantly un-reveal all items
            timers.forEach(function (t) { clearTimeout(t); });
            entry.target._staggerTimers = [];
            items.forEach(function (item) {
              item.classList.remove('visible');
            });
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -20px 0px',
      }
    );

    staggerGroups.forEach(function (group) {
      staggerObserver.observe(group);
    });
  }

  /* --------------------------------------------------------
     5. Anchor links — handled by initSectionSnap IIFE below
        which exposes window._EHW.goToSection
  -------------------------------------------------------- */

  /* --------------------------------------------------------
     6. Hover sound — lighter clicky tick on mouseenter
        Same noise-burst character as the click sound but
        shorter, quieter, and filtered higher so it reads
        as a distinct "hover" rather than a "press".
        Debounced at 80ms so fast sweeps don't stack up.
  -------------------------------------------------------- */
  (function initHoverSound() {
    var hoverCtx = null;
    var lastHover = 0;

    function getHoverCtx() {
      if (!hoverCtx) {
        hoverCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return hoverCtx;
    }

    function playHover() {
      var now = Date.now();
      if (now - lastHover < 80) return;
      lastHover = now;

      try {
        var ctx = getHoverCtx();
        if (ctx.state === 'suspended') ctx.resume();

        /* Very short noise burst — half the length of the click */
        var length = Math.floor(ctx.sampleRate * 0.014);
        var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        var data   = buffer.getChannelData(0);
        for (var i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.18));
        }

        var source = ctx.createBufferSource();
        source.buffer = buffer;

        /* Quieter gain than the click */
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0.09, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.014);

        /* Higher highpass → crisper, airier than the click */
        var hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 2800;

        source.connect(hpf);
        hpf.connect(gain);
        gain.connect(ctx.destination);
        source.start();
      } catch (e) { /* silent fail */ }
    }

    /* Every interactive element on the page */
    var targets = document.querySelectorAll(
      'a, button, .gallery-item, .ba-item, .modal-dot, .hamburger'
    );
    targets.forEach(function (el) {
      el.addEventListener('mouseenter', playHover);
    });
  }());

  /* --------------------------------------------------------
     7. Click sound — Web Audio API synthesised tick
        Short noise burst shaped by a fast gain envelope.
        Lazy-initialises AudioContext on first interaction
        to satisfy browser autoplay policy.
  -------------------------------------------------------- */
  (function initClickSound() {
    var audioCtx = null;

    function getCtx() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return audioCtx;
    }

    function playClick() {
      try {
        var ctx = getCtx();
        if (ctx.state === 'suspended') { ctx.resume(); }

        var sampleRate = ctx.sampleRate;
        /* 30 ms of noise — short enough to feel mechanical */
        var length = Math.floor(sampleRate * 0.03);
        var buffer = ctx.createBuffer(1, length, sampleRate);
        var data = buffer.getChannelData(0);

        for (var i = 0; i < length; i++) {
          /* white noise shaped by a steep exponential decay */
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.12));
        }

        var source = ctx.createBufferSource();
        source.buffer = buffer;

        /* Gentle gain so it's audible but not jarring */
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);

        /* High-pass filter — removes low rumble, keeps the crisp click */
        var hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 1200;

        source.connect(hpf);
        hpf.connect(gain);
        gain.connect(ctx.destination);
        source.start();
      } catch (e) {
        /* silently ignore — audio is an enhancement, not critical */
      }
    }

    document.addEventListener('mousedown', playClick);
  }());

  /* --------------------------------------------------------
     7. Form — presentational submit handler
        Shows "Sent." in button, resets after 3s
  -------------------------------------------------------- */
  const quoteForm = document.getElementById('quote-form');
  const submitBtn = document.getElementById('form-submit');

  if (quoteForm && submitBtn) {
    quoteForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const originalText = submitBtn.textContent;

      submitBtn.textContent = 'Sent.';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.6';

      setTimeout(function () {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '';
        quoteForm.reset();
      }, 3000);
    });
  }

})();

/* ============================================================
   IMAGE LIGHTBOX — click any gallery/BA image to view full size
   ============================================================ */
(function initLightbox() {
  'use strict';

  var modal      = document.getElementById('project-modal');
  var slidesWrap = document.getElementById('modal-slides');
  var dotsWrap   = document.getElementById('modal-dots');
  var titleEl    = document.getElementById('modal-title');
  var locEl      = document.getElementById('modal-loc');
  var closeBtn   = document.getElementById('modal-close');
  var prevBtn    = document.getElementById('modal-prev');
  var nextBtn    = document.getElementById('modal-next');

  if (!modal) return;

  var slides  = [];
  var dots    = [];
  var current = 0;

  /* Collect all gallery images into a flat array for navigation */
  var allImages = [];

  document.querySelectorAll('.gallery-item img, .ba-item img').forEach(function (img) {
    var label = '';
    var baLabel = img.closest('.ba-item') ? img.closest('.ba-item').querySelector('.ba-label') : null;
    var groupHeading = img.closest('.gallery-group') ? img.closest('.gallery-group').querySelector('.gallery-heading') : null;

    if (groupHeading) label = groupHeading.textContent;
    if (baLabel) label += (label ? ' — ' : '') + baLabel.textContent;

    allImages.push({
      src: img.src,
      alt: img.alt,
      label: label
    });
  });

  function goTo(index) {
    if (!slides.length) return;
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
    titleEl.textContent = allImages[current].label;
  }

  function openAt(startIndex) {
    slidesWrap.innerHTML = '';
    dotsWrap.innerHTML   = '';
    slides  = [];
    dots    = [];
    current = 0;

    titleEl.textContent = allImages[startIndex].label;
    locEl.textContent   = '';

    allImages.forEach(function (item, i) {
      var slide = document.createElement('div');
      slide.className = 'modal-slide' + (i === startIndex ? ' active' : '');
      var img = document.createElement('img');
      img.src     = item.src;
      img.alt     = item.alt;
      img.loading = i === startIndex ? 'eager' : 'lazy';
      slide.appendChild(img);
      slidesWrap.appendChild(slide);
      slides.push(slide);

      var dot = document.createElement('button');
      dot.className = 'modal-dot' + (i === startIndex ? ' active' : '');
      dot.setAttribute('aria-label', 'Photo ' + (i + 1));
      (function (idx) {
        dot.addEventListener('click', function () { goTo(idx); });
      }(i));
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });

    current = startIndex;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* Wire up each gallery image */
  document.querySelectorAll('.gallery-item, .ba-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var img = this.querySelector('img');
      var idx = allImages.findIndex(function (i) { return i.src === img.src; });
      if (idx >= 0) openAt(idx);
    });
  });

  /* Controls */
  closeBtn.addEventListener('click', closeModal);
  prevBtn.addEventListener('click',  function () { goTo(current - 1); });
  nextBtn.addEventListener('click',  function () { goTo(current + 1); });

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape')      closeModal();
    if (e.key === 'ArrowLeft')   goTo(current - 1);
    if (e.key === 'ArrowRight')  goTo(current + 1);
  });

  var touchStartX = 0;
  modal.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  modal.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) goTo(dx < 0 ? current + 1 : current - 1);
  }, { passive: true });

}());

/* ============================================================
   SECTION SNAP — slideshow-style scroll, one section at a time
   easeInOutQuart velocity curve, debounced wheel events
   ============================================================ */
(function initSectionSnap() {
  'use strict';

  var sections = Array.from(document.querySelectorAll(
    '.hero, #work, #about, .testimonials-section, .contact-section, .site-footer'
  ));
  if (!sections.length) return;

  var isAnimating = false;
  var DURATION = 350;

  /* easeOutExpo — snaps to position almost instantly, then settles smoothly */
  function ease(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function animateTo(targetY) {
    var startY = window.scrollY;
    var dist   = targetY - startY;
    if (Math.abs(dist) < 2) { isAnimating = false; return; }

    isAnimating = true;
    var startTs = null;

    function tick(ts) {
      if (!startTs) startTs = ts;
      var p = Math.min((ts - startTs) / DURATION, 1);
      window.scrollTo(0, startY + dist * ease(p));
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        isAnimating = false;
      }
    }
    requestAnimationFrame(tick);
  }

  function getSectionTops() {
    return sections.map(function (s) {
      return Math.round(s.getBoundingClientRect().top + window.scrollY);
    });
  }

  function getCurrentIdx() {
    var tops   = getSectionTops();
    var scrollY = window.scrollY + window.innerHeight * 0.25;
    var idx = 0;
    for (var i = 0; i < tops.length; i++) {
      if (tops[i] <= scrollY) idx = i;
    }
    return idx;
  }

  function goTo(idx) {
    idx = Math.max(0, Math.min(sections.length - 1, idx));
    animateTo(getSectionTops()[idx]);
  }

  /* Expose for anchor links */
  window._EHW = window._EHW || {};
  window._EHW.goToSection = goTo;

  /* ── Wheel ── */
  var wheelCooldown = false;
  var wheelTimer;

  /* Check if current section is taller than viewport */
  function isTallSection(idx) {
    var sec = sections[idx];
    return sec.offsetHeight > window.innerHeight * 1.15;
  }

  /* Check if user can still scroll within a tall section */
  function canScrollWithin(idx, direction) {
    var sec = sections[idx];
    var secTop = Math.round(sec.getBoundingClientRect().top + window.scrollY);
    var secBottom = secTop + sec.offsetHeight;
    var viewTop = window.scrollY;
    var viewBottom = viewTop + window.innerHeight;

    if (direction > 0) {
      /* Scrolling down — allow if section bottom not yet visible */
      return secBottom - viewBottom > 40;
    } else {
      /* Scrolling up — allow if section top not yet visible */
      return viewTop - secTop > 40;
    }
  }

  window.addEventListener('wheel', function (e) {
    /* Skip when modal is open */
    var modal = document.getElementById('project-modal');
    if (modal && modal.classList.contains('open')) return;

    /* Skip when focus is inside a scrollable form element */
    var active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;

    var direction = e.deltaY > 0 ? 1 : -1;
    var idx = getCurrentIdx();

    /* For tall sections, allow normal scrolling until edge is reached */
    if (isTallSection(idx) && canScrollWithin(idx, direction)) {
      return; /* Let the browser handle the scroll naturally */
    }

    e.preventDefault();
    if (isAnimating) return;
    if (wheelCooldown) return;

    wheelCooldown = true;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () { wheelCooldown = false; }, 100);

    goTo(idx + direction);
  }, { passive: false });

  /* ── Touch ── */
  var touchStartY = 0;

  window.addEventListener('touchstart', function (e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchend', function (e) {
    var modal = document.getElementById('project-modal');
    if (modal && modal.classList.contains('open')) return;
    if (isAnimating) return;

    var dy = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 48) {
      var direction = dy > 0 ? 1 : -1;
      var idx = getCurrentIdx();

      /* For tall sections, allow normal scrolling until edge is reached */
      if (isTallSection(idx) && canScrollWithin(idx, direction)) return;

      goTo(idx + direction);
    }
  }, { passive: true });

  /* ── Anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var href = this.getAttribute('href');

      if (href === '#') { e.preventDefault(); goTo(0); return; }

      var target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      var idx = sections.indexOf(target);
      if (idx >= 0) {
        goTo(idx);
      } else {
        /* Resolve to the section that contains the target */
        var targetTop = target.getBoundingClientRect().top + window.scrollY;
        var tops = getSectionTops();
        var nearestIdx = 0;
        for (var i = 0; i < tops.length; i++) {
          if (tops[i] <= targetTop) nearestIdx = i;
        }
        goTo(nearestIdx);
      }
    });
  });

}());

/* ============================================================
   CUSTOM CURSOR — leaf follows mouse, rotates on hover
   ============================================================ */
(function initCustomCursor() {
  'use strict';

  if (!window.matchMedia('(pointer: fine)').matches) return;

  var leaf = document.createElement('div');
  leaf.className = 'leaf-cursor';
  leaf.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    '<path d="M3 3 C6 12 8 22 14 28 C20 32 30 28 29 18 C28 8 18 2 3 3 Z" fill="#2c5028" opacity="0.85"/>' +
    '<line x1="3" y1="3" x2="22" y2="26" stroke="#a8c4a0" stroke-width="0.9" stroke-linecap="round"/></svg>';
  document.body.appendChild(leaf);
  document.documentElement.classList.add('has-custom-cursor');

  var hovering = false;
  var INTERACTIVE = 'a, button, label, select, [role="button"], .gallery-item, .ba-item, .hero-scroll, input[type="submit"]';

  document.addEventListener('mousemove', function (e) {
    leaf.style.translate = (e.clientX - 3) + 'px ' + (e.clientY - 3) + 'px';

    var isText = e.target.matches('input:not([type="submit"]):not([type="button"]), textarea');
    leaf.style.opacity = isText ? '0' : '';

    var hit = e.target.closest(INTERACTIVE);
    if (hit && !hovering) {
      hovering = true;
      leaf.classList.add('hovering');
    } else if (!hit && hovering) {
      hovering = false;
      leaf.classList.remove('hovering');
    }
  }, { passive: true });

  document.addEventListener('mouseleave', function () { leaf.style.opacity = '0'; });
  document.addEventListener('mouseenter', function () { leaf.style.opacity = ''; });
}());

