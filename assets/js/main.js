// On refresh, come back to the same spot: remember the scroll position (and
// which tab was open) for this page, and restore it once the page has laid out.
// Any #section hash from an in-page link is dropped so it doesn't win instead.
var restore = (function () {
  var key = 'scroll:' + location.pathname;
  var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  var isReload = !!nav && nav.type === 'reload';
  var saved = null;

  try { saved = JSON.parse(sessionStorage.getItem(key)); } catch (e) {}

  window.addEventListener('pagehide', function () {
    var tabs = {};
    document.querySelectorAll('[data-tabs] [role="tab"][aria-selected="true"]').forEach(function (t, i) {
      tabs[i] = t.id;
    });
    try { sessionStorage.setItem(key, JSON.stringify({ y: window.scrollY, tabs: tabs })); } catch (e) {}
  });

  if (!isReload || !saved) return { tab: function () { return null; } };

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  function go() { window.scrollTo({ top: saved.y, left: 0, behavior: 'instant' }); }
  document.addEventListener('DOMContentLoaded', go);
  window.addEventListener('load', go);

  return { tab: function (i) { return saved.tabs && saved.tabs[i]; } };
})();

// Fade sections in as they enter the viewport.
(function () {
  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });
  items.forEach(function (el) { io.observe(el); });
})();

// Lightbox: click any content image (not ones inside links) to view it
// centred over a dimmed overlay. Esc, the close button or the overlay closes it.
(function () {
  var images = Array.prototype.filter.call(
    document.querySelectorAll('main img'),
    function (img) { return !img.closest('a, [data-flip]'); }
  );
  if (!images.length) return;

  var box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Image viewer');
  box.hidden = true;
  box.innerHTML =
    '<button class="lightbox__close" type="button" aria-label="Close image"><svg class="icon" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg></button>' +
    '<img class="lightbox__img" alt="">';
  document.body.appendChild(box);

  var big = box.querySelector('.lightbox__img');
  var closeBtn = box.querySelector('.lightbox__close');
  var opener = null;
  var fitMax = '';

  // Fitted phone screens: click to zoom in (scroll to read), click again to fit
  big.addEventListener('click', function () {
    if (!box.classList.contains('lightbox--fit-height')) return;
    var zoomed = box.classList.toggle('lightbox--zoomed');
    big.style.maxHeight = zoomed ? '' : fitMax;
    box.scrollTop = 0;
  });

  function open(img) {
    opener = img;
    big.src = img.getAttribute('data-full') || img.currentSrc || img.src;
    big.alt = img.alt;
    // Phone screenshots open fitted to the screen height so the whole screen
    // is visible; clicking the image zooms in. A phone shot = a narrow,
    // portrait image; very long page captures (over 4:1) still scroll at width
    var w = img.naturalWidth, h = img.naturalHeight;
    var portrait = w > 0 && w <= 1080 && h > w * 1.2 && h < w * 4;
    box.classList.toggle('lightbox--fit-height', portrait || !!img.closest('[data-fit="height"], .tabs__ba, .hero__phones'));
    box.classList.remove('lightbox--zoomed');
    // ...but small crops are not blown up beyond 1.5x their real size
    fitMax = img.naturalHeight ? img.naturalHeight * 1.5 + 'px' : '';
    big.style.maxHeight = fitMax;
    box.scrollTop = 0;
    box.hidden = false;
    document.documentElement.classList.add('lightbox-open');
    requestAnimationFrame(function () { box.classList.add('is-open'); });
    closeBtn.focus();
  }

  function close() {
    box.classList.remove('is-open');
    document.documentElement.classList.remove('lightbox-open');
    setTimeout(function () { box.hidden = true; big.removeAttribute('src'); }, 200);
    if (opener) opener.focus();
  }

  images.forEach(function (img) {
    img.classList.add('zoomable');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Expand image: ' + img.alt);
    img.addEventListener('click', function () { open(img); });
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
    });
  });

  box.addEventListener('click', function (e) {
    if (e.target !== big) close();
  });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
  });
})();

// Tabs: click or arrow keys switch panels; [data-tab-target] buttons inside a
// panel jump to another tab. Without JS every panel stays visible.
(function () {
  document.querySelectorAll('[data-tabs]').forEach(function (root, n) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    }

    // After a refresh, reopen the tab that was showing
    var savedTab = document.getElementById(restore.tab(n));
    select((savedTab && tabs.indexOf(savedTab) > -1 && savedTab) ||
      tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]);

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') next = tabs[0];
        if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });

    root.querySelectorAll('[data-tab-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        select(document.getElementById(btn.getAttribute('data-tab-target')), true);
        root.scrollIntoView({ block: 'start' });
      });
    });
  });
})();

// No widows: join the last two words of every text block with a non-breaking
// space, so a single word never sits alone on the last line.
(function () {
  var blocks = document.querySelectorAll(
    'main p, main h1, main h2, main h3, main h4, main li, main dd, main dt, ' +
    'main small, main figcaption, main b, main blockquote'
  );
  blocks.forEach(function (el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) {
      if (n.data.trim()) nodes.push(n);
    }
    // Walk back from the end to the last space between two words
    for (var i = nodes.length - 1; i >= 0; i--) {
      var t = nodes[i].data.replace(/\s+$/, '');
      var k = t.lastIndexOf(' ');
      if (k > 0 && /\S/.test(t.slice(0, k))) {
        nodes[i].data = t.slice(0, k) + '\u00a0' + t.slice(k + 1) + nodes[i].data.slice(t.length);
        return;
      }
      if (k === 0) {
        // The node starts with a space: the break sits before it
        nodes[i].data = '\u00a0' + nodes[i].data.slice(1);
        return;
      }
    }
  });
})();

// Folder cards: the title's first line sits on the tab, so size the tab to the
// title (at least the default 58%), leaving room for the curve on the right.
// A title too long even for that wraps onto the panel below.
(function () {
  var cards = document.querySelectorAll('.folder');
  if (!cards.length) return;

  function fit() {
    cards.forEach(function (card) {
      var body = card.querySelector('.folder__body');
      var title = card.querySelector('.folder__head b');
      var curve = card.querySelector('.folder__curve');
      if (!body || !title) return;
      card.style.removeProperty('--tab-w');
      card.style.removeProperty('--title-max');

      var pad = parseFloat(getComputedStyle(body).paddingLeft);
      var gap = pad / 2;
      var bodyW = body.getBoundingClientRect().width;
      var maxTab = bodyW - (curve ? curve.getBoundingClientRect().width : 0) - pad;

      // Measure the text itself, not the block it sits in
      title.style.whiteSpace = 'nowrap';
      title.style.display = 'inline-block';
      var textW = title.getBoundingClientRect().width;
      title.style.whiteSpace = '';
      title.style.display = '';

      // The tab hugs the title: padding + text + a small gap, never past the card
      var tab = Math.min(pad + textW + gap, maxTab);
      card.style.setProperty('--tab-w', tab + 'px');
      card.style.setProperty('--title-max', (tab - pad - gap) + 'px');
    });
  }

  fit();
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(fit);
    cards.forEach(function (c) { ro.observe(c); });
  } else {
    window.addEventListener('resize', fit);
  }
})();

// Iteration deck: click the card (or Enter/Space, or the arrow buttons) to
// bring the next iteration forward. After the final one it starts over.
(function () {
  document.querySelectorAll('[data-flip]').forEach(function (root) {
    var stage = root.querySelector('.flip__stage');
    var cards = Array.prototype.slice.call(root.querySelectorAll('.flip__card'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.flip__dot'));
    var num = root.querySelector('[data-flip-current]');
    var status = root.querySelector('[data-flip-status]');
    var prev = root.querySelector('[data-flip-prev]');
    var next = root.querySelector('[data-flip-next]');
    var last = cards.length - 1;
    // The card marked data-final is the design taken forward (defaults to the last)
    var fin = cards.findIndex(function (c) { return c.hasAttribute('data-final'); });
    if (fin < 0) fin = last;
    var i = 0;

    function render() {
      cards.forEach(function (c, k) {
        c.classList.toggle('is-current', k === i);
        c.classList.toggle('is-next', k === i + 1);
        c.classList.toggle('is-next2', k === i + 2);
        c.classList.toggle('is-past', k < i);
      });
      dots.forEach(function (d, k) {
        d.classList.toggle('is-on', k < i);
        d.classList.toggle('is-current', k === i);
      });
      num.textContent = String(i + 1).padStart(2, '0');
      status.textContent = i === fin ? 'Final: taken forward' : 'Iteration';
      status.classList.toggle('is-final', i === fin);
      prev.disabled = i === 0;
      stage.setAttribute('aria-label', i === last ? 'Start again from the first card' : 'Show the next iteration');
    }

    function go(step) {
      i = i + step > last ? 0 : Math.max(0, i + step);
      render();
    }

    // Autoplay: steps through on its own while the deck is on screen, holds a
    // little longer on the final card, pauses on hover or focus, and stops for
    // good once someone takes over. Off for reduced motion.
    var STEP = 1500, HOLD_FINAL = 3000;
    var timer = null, visible = false, paused = false, stopped = false;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function schedule() {
      clearTimeout(timer);
      if (stopped || reduce || !visible || paused) return;
      timer = setTimeout(function () { go(1); schedule(); }, i === fin ? HOLD_FINAL : STEP);
    }

    function takeOver() {
      stopped = true;
      clearTimeout(timer);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.5 }).observe(stage);
    }
    root.addEventListener('mouseenter', function () { paused = true; schedule(); });
    root.addEventListener('mouseleave', function () { paused = false; schedule(); });
    root.addEventListener('focusin', function () { paused = true; schedule(); });
    root.addEventListener('focusout', function () { paused = false; schedule(); });

    root.classList.add('is-ready');
    stage.addEventListener('click', function () { takeOver(); go(1); });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); takeOver(); go(1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); takeOver(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); takeOver(); go(-1); }
    });
    prev.addEventListener('click', function () { takeOver(); go(-1); });
    next.addEventListener('click', function () { takeOver(); go(1); });
    render();
  });
})();
