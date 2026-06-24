/* Sol-Arch interactions. Pure vanilla JS, no dependencies. */
(function () {
  'use strict';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Theme: system-aware, persists across pages (URL + localStorage),
       and crossfades on toggle. URL carry makes it survive file:// navigation
       even where localStorage is isolated per-file (e.g. Safari). ---------- */
  var root = document.documentElement;
  var themeBtn = $('.theme-toggle');

  function urlHasTheme() { try { var v = new URLSearchParams(location.search).get('theme'); return v === 'light' || v === 'dark'; } catch (e) { return false; } }
  function lsHasTheme() { try { var v = localStorage.getItem('theme'); return v === 'light' || v === 'dark'; } catch (e) { return false; } }
  var explicit = urlHasTheme() || lsHasTheme();

  function withTheme(href, t) {
    if (!href || href.charAt(0) === '#') return href;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return href;
    if (!/\.html(\?|#|$)/.test(href)) return href; // only internal page links
    var hash = '', h = href, hi = h.indexOf('#');
    if (hi >= 0) { hash = h.slice(hi); h = h.slice(0, hi); }
    var base = h, query = '', qi = h.indexOf('?');
    if (qi >= 0) { base = h.slice(0, qi); query = h.slice(qi + 1); }
    var parts = query ? query.split('&').filter(function (p) { return p && p.indexOf('theme=') !== 0; }) : [];
    parts.push('theme=' + t);
    return base + '?' + parts.join('&') + hash;
  }
  function decorateLinks(t) {
    $$('a[href]').forEach(function (a) { var nh = withTheme(a.getAttribute('href'), t); if (nh) a.setAttribute('href', nh); });
  }
  function syncThemeBtn(t) {
    if (!themeBtn) return;
    var light = t === 'light';
    themeBtn.setAttribute('aria-pressed', light ? 'true' : 'false');
    themeBtn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  }
  function applyTheme(t, animate) {
    if (animate && !reduceMotion) {
      root.classList.add('theme-transition');
      window.setTimeout(function () { root.classList.remove('theme-transition'); }, 480);
    }
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) {}
    try { var u = new URL(location.href); u.searchParams.set('theme', t); history.replaceState(null, '', u); } catch (e) {}
    decorateLinks(t);
    syncThemeBtn(t);
  }

  var current = root.getAttribute('data-theme') || 'dark';
  syncThemeBtn(current);
  if (explicit) decorateLinks(current); // keep choice when navigating
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      explicit = true;
      applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
    });
  }
  try {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
      if (explicit) return; // respect explicit choice
      root.setAttribute('data-theme', e.matches ? 'light' : 'dark');
      syncThemeBtn(root.getAttribute('data-theme'));
    });
  } catch (e) {}

  /* ---------- Header: scrolled state + scroll-progress bar ---------- */
  var header = $('.header');
  var progress = $('.scroll-progress');
  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (header) header.classList.toggle('scrolled', y > 100);
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav overlay ---------- */
  var burger = $('.burger'), overlay = $('.nav-overlay');
  function setNav(open) {
    if (!overlay) return;
    overlay.classList.toggle('open', open);
    overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
    if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { var fl = overlay.querySelector('a, button'); if (fl) fl.focus(); }
    else if (burger) burger.focus();
  }
  if (burger) burger.addEventListener('click', function () { setNav(!overlay.classList.contains('open')); });
  if (overlay) {
    $$('.nav-overlay a, .nav-overlay__close', overlay).forEach(function (a) {
      a.addEventListener('click', function () { setNav(false); });
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });

  /* ---------- Scroll reveals ---------- */
  var reveals = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en, i) {
        if (en.isIntersecting) {
          var el = en.target;
          var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
          setTimeout(function () { el.classList.add('in-view'); }, delay);
          io.unobserve(el);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Stat counters (animate on scroll) ---------- */
  /* year values count DOWN from the current year; plain counts count up from 0 */
  var counters = $$('.num[data-count]');
  function runCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    if (reduceMotion) { el.textContent = target; return; }
    var nowYear = new Date().getFullYear();
    if (isNaN(nowYear) || nowYear < 2026) nowYear = 2026; // default to the site's build year if the clock is off
    var start = target >= 1900 ? nowYear : 0, dur = 1200, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(step); else el.textContent = target;
    }
    requestAnimationFrame(step);
  }
  if (counters.length) {
    if (!('IntersectionObserver' in window)) {
      counters.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
    } else {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { runCount(en.target); cio.unobserve(en.target); } });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { cio.observe(el); });
    }
  }

  /* ---------- Hero: crossfade rotation + cycling project index ---------- */
  var heroImgs = $$('.hero__media img');
  var heroIndex = $('#hero-index');
  if (heroImgs.length) {
    var nameEl = heroIndex && heroIndex.querySelector('.hero__index-name');
    var show = function (i) {
      heroImgs.forEach(function (im, k) { im.style.opacity = (k === i) ? '1' : '0'; });
      var im = heroImgs[i];
      if (nameEl && im.getAttribute('data-name')) nameEl.textContent = im.getAttribute('data-name');
    };
    if (heroImgs.length > 1 && !reduceMotion) {
      var hi = 0;
      setInterval(function () { hi = (hi + 1) % heroImgs.length; show(hi); }, 5000);
    }
  }
  var parallaxEls = $$('[data-parallax]');
  if (!reduceMotion && parallaxEls.length && window.innerWidth > 860) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset;
        parallaxEls.forEach(function (el) {
          var speed = parseFloat(el.getAttribute('data-parallax')) || 0.06;
          el.style.transform = 'translate3d(0,' + (y * speed) + 'px,0)';
        });
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- Portfolio: filter + GRID/INDEX toggle + hash ---------- */
  var grid = $('#work-grid'), table = $('#index-table');
  if (grid || table) {
    var pills = $$('.pill');
    var cards = $$('[data-categories]');                 // grid cards + index rows (both filtered)
    var countSet = grid ? $$('[data-categories]', grid) : cards; // count projects once, not per-view
    var crumb = $('#work-crumb');
    var catLabels = {};
    pills.forEach(function (p) { catLabels[p.getAttribute('data-filter')] = p.getAttribute('data-label') || p.textContent.trim(); });

    var gridCards = grid ? $$('.card', grid) : [];
    function applyFilter(cat) {
      cat = cat || 'all';
      pills.forEach(function (p) {
        var on = p.getAttribute('data-filter') === cat;
        p.classList.toggle('active', on);
        p.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      cards.forEach(function (el) {
        var cats = (el.getAttribute('data-categories') || '').split(' ');
        var match = (cat === 'all') || cats.indexOf(cat) !== -1;
        el.classList.toggle('is-hidden', !match);
      });
      // editorial feature-wide lead only in the default ALL grid (avoids a hole when filtered)
      gridCards.forEach(function (c, i) { c.classList.toggle('feature-wide', cat === 'all' && i === 0); });
      var shown = countSet.filter(function (el) {
        var cats = (el.getAttribute('data-categories') || '').split(' ');
        return (cat === 'all') || cats.indexOf(cat) !== -1;
      }).length;
      if (crumb) crumb.textContent = (cat === 'all')
        ? 'WORK / ALL · ' + shown + ' PROJECTS'
        : 'WORK / ' + (catLabels[cat] || cat).toUpperCase() + ' · ' + shown + ' PROJECTS';
    }

    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        var cat = p.getAttribute('data-filter');
        if (cat === 'all') { history.pushState(null, '', location.pathname); }
        else { location.hash = cat; }
        applyFilter(cat);
      });
    });

    var viewBtns = $$('.view-toggle button');
    function setView(v) {
      viewBtns.forEach(function (b) {
        var on = b.getAttribute('data-view') === v;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (grid) grid.classList.toggle('is-hidden', v !== 'grid');
      if (table) table.classList.toggle('is-hidden', v !== 'index');
    }
    viewBtns.forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-view')); }); });
    setView('grid');

    var initial = (location.hash || '').replace('#', '');
    applyFilter(initial && catLabels[initial] ? initial : 'all');
    window.addEventListener('hashchange', function () {
      var c = (location.hash || '').replace('#', '');
      applyFilter(catLabels[c] ? c : 'all');
    });
  }

  /* ---------- YouTube facade (lite embed) ---------- */
  $$('.video-facade').forEach(function (f) {
    var activate = function () {
      var id = f.getAttribute('data-yt');
      if (!id) return;
      // A YouTube embed can't initialise from a file:// page (null origin -> "Error 153,
      // video player configuration error"). Locally, open it on YouTube; when the site is
      // served over http(s) the inline embed works normally.
      if (location.protocol === 'file:') {
        window.open('https://www.youtube.com/watch?v=' + id, '_blank', 'noopener');
        return;
      }
      var wrap = document.createElement('div');
      wrap.className = 'video-embed';
      var ifr = document.createElement('iframe');
      ifr.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      ifr.title = 'Project film';
      ifr.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      ifr.allowFullscreen = true;
      wrap.appendChild(ifr);
      f.parentNode.replaceChild(wrap, f);
    };
    f.addEventListener('click', activate);
    f.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  /* ---------- Lightbox (project galleries) ---------- */
  var shots = $$('.gallery .shot[data-full]');
  if (shots.length) {
    var single = shots.length <= 1;
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Project image gallery');
    lb.innerHTML =
      '<button class="lb-close" aria-label="Close gallery">✕</button>' +
      (single ? '' : '<button class="lb-arrow prev" aria-label="Previous image">←</button>') +
      '<img class="lightbox__img" alt="">' +
      (single ? '' : '<button class="lb-arrow next" aria-label="Next image">→</button>') +
      '<div class="lb-cap"></div><div class="lb-progress"></div>';
    document.body.appendChild(lb);
    var lbImg = $('.lightbox__img', lb), lbCap = $('.lb-cap', lb), lbBar = $('.lb-progress', lb);
    var items = shots.map(function (s) {
      return { full: s.getAttribute('data-full'), cap: s.getAttribute('data-cap') || '' };
    });
    var idx = 0, lastFocused = null;
    function render() {
      var it = items[idx];
      lbImg.src = it.full;
      lbImg.alt = it.cap || ('Image ' + (idx + 1));
      lbCap.innerHTML = '<b>' + (it.cap || 'Sol-Arch') + '</b>' +
        (idx + 1) + ' / ' + items.length;
      lbBar.style.width = ((idx + 1) / items.length * 100) + '%';
    }
    function open(i, trigger) {
      idx = i; render(); lb.classList.add('open'); document.body.style.overflow = 'hidden';
      lastFocused = trigger || document.activeElement;
      var c = $('.lb-close', lb); if (c) c.focus();
    }
    function close() {
      lb.classList.remove('open'); document.body.style.overflow = ''; lbImg.src = '';
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
    function go(d) { idx = (idx + d + items.length) % items.length; render(); }
    shots.forEach(function (s, i) {
      s.addEventListener('click', function () { open(i, s); });
      s.setAttribute('tabindex', '0'); s.setAttribute('role', 'button');
      if (!s.getAttribute('aria-label')) s.setAttribute('aria-label', 'View image ' + (i + 1) + ' full size');
      s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i, s); } });
    });
    $('.lb-close', lb).addEventListener('click', close);
    var arrPrev = $('.lb-arrow.prev', lb), arrNext = $('.lb-arrow.next', lb);
    if (arrPrev) arrPrev.addEventListener('click', function (e) { e.stopPropagation(); go(-1); });
    if (arrNext) arrNext.addEventListener('click', function (e) { e.stopPropagation(); go(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'Tab') {
        var f = $$('.lb-close, .lb-arrow', lb);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // swipe
    var sx = 0;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  /* ---------- Contact enquiry form (no backend; honest inline confirmation) ---------- */
  var enquiry = $('.enquiry');
  if (enquiry) {
    enquiry.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!enquiry.checkValidity()) { enquiry.reportValidity(); return; }
      var phone = enquiry.getAttribute('data-phone') || '';
      var done = document.createElement('div');
      done.innerHTML = '<p class="lead">Thank you. We’ll be in touch shortly.</p>' +
        '<p class="mono muted" style="margin-top:14px;display:flex;align-items:center">Prefer to talk now? Call ' + phone + '.</p>';
      enquiry.replaceWith(done);
    });
  }
})();
