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
// Screens rebuilt in code ([data-screen]) open the same way, as a live copy.
(function () {
  var images = Array.prototype.filter.call(
    document.querySelectorAll('main img, main [data-screen]'),
    function (img) { return !img.closest('a, [data-flip]') && !(img.tagName === 'IMG' && img.closest('[data-screen]')); }
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
    '<img class="lightbox__img" alt="">' +
    '<div class="lightbox__img lightbox__screen" role="img" hidden></div>';
  document.body.appendChild(box);

  var bigImg = box.querySelector('img.lightbox__img');
  var bigScreen = box.querySelector('.lightbox__screen');
  var big = bigImg;
  var closeBtn = box.querySelector('.lightbox__close');
  var opener = null;
  var fitMax = '';

  // Scale a live screen copy to the width it is shown at
  function fitScreen() {
    var screen = bigScreen.firstElementChild;
    if (screen && bigScreen.clientWidth) {
      bigScreen.style.setProperty('--s', bigScreen.clientWidth / screen.offsetWidth);
    }
  }
  window.addEventListener('resize', fitScreen);

  // Fitted phone screens: click to zoom in (scroll to read), click again to fit
  function toggleZoom() {
    if (!box.classList.contains('lightbox--fit-height')) return;
    var zoomed = box.classList.toggle('lightbox--zoomed');
    big.style.maxHeight = zoomed ? '' : fitMax;
    box.scrollTop = 0;
    fitScreen();
  }
  bigImg.addEventListener('click', toggleZoom);
  bigScreen.addEventListener('click', toggleZoom);

  function openScreen(frame) {
    opener = frame;
    big = bigScreen;
    bigImg.hidden = true;
    bigScreen.hidden = false;
    // A fresh copy, so its animation starts from the top
    bigScreen.innerHTML = frame.innerHTML;
    bigScreen.setAttribute('aria-label', frame.getAttribute('aria-label') || '');
    box.classList.add('lightbox--fit-height');
    box.classList.remove('lightbox--zoomed');
    fitMax = '';
    big.style.maxHeight = '';
    box.scrollTop = 0;
    box.hidden = false;
    fitScreen();
    document.documentElement.classList.add('lightbox-open');
    requestAnimationFrame(function () { box.classList.add('is-open'); });
    closeBtn.focus();
  }

  function open(img) {
    if (img.hasAttribute('data-screen')) return openScreen(img);
    opener = img;
    big = bigImg;
    bigScreen.hidden = true;
    bigScreen.innerHTML = '';
    bigImg.hidden = false;
    big.src = img.getAttribute('data-full') || img.currentSrc || img.src;
    big.alt = img.alt;
    // Phone screenshots open fitted to the screen height so the whole screen
    // is visible; clicking the image zooms in. A phone shot = a narrow,
    // portrait image; very long page captures (over 4:1) still scroll at width
    var w = img.naturalWidth, h = img.naturalHeight;
    var portrait = w > 0 && w <= 1080 && h > w * 1.2 && h < w * 4;
    box.classList.toggle('lightbox--fit-height', portrait || !!img.closest('[data-fit="height"], .tabs__ba, .hero__phones'));
    box.classList.remove('lightbox--zoomed');
    // ...but small crops are not blown up beyond 1.5x their real size. A
    // cropped thumbnail opens its full screen (data-full), so the cap follows
    // the full image once it loads
    fitMax = img.naturalHeight ? img.naturalHeight * 1.5 + 'px' : '';
    big.style.maxHeight = fitMax;
    big.onload = function () {
      big.onload = null;
      if (!big.naturalHeight || big.naturalHeight <= img.naturalHeight) return;
      fitMax = big.naturalHeight * 1.5 + 'px';
      if (!box.classList.contains('lightbox--zoomed')) big.style.maxHeight = fitMax;
    };
    box.scrollTop = 0;
    box.hidden = false;
    document.documentElement.classList.add('lightbox-open');
    requestAnimationFrame(function () { box.classList.add('is-open'); });
    closeBtn.focus();
  }

  function close() {
    box.classList.remove('is-open');
    document.documentElement.classList.remove('lightbox-open');
    setTimeout(function () { box.hidden = true; bigImg.removeAttribute('src'); bigScreen.innerHTML = ''; }, 200);
    if (opener) opener.focus();
  }

  images.forEach(function (img) {
    img.classList.add('zoomable');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Expand image: ' + (img.alt || img.getAttribute('aria-label') || ''));
    img.addEventListener('click', function () { open(img); });
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
    });
  });

  box.addEventListener('click', function (e) {
    if (e.target !== bigImg && !bigScreen.contains(e.target)) close();
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

// No widows: keep the last two words of every text block together on the last
// line. They are wrapped in a span that doesn't break inside, which also stops
// a break at a hyphen ("developer-ready") or before a small badge at the end.
// Applies to every innermost text block (p, li, headings, labels, pills…).
(function () {
  function isInline(el) { return getComputedStyle(el).display === 'inline'; }

  // Innermost blocks: not inline themselves, and nothing but inline content inside
  var blocks = Array.prototype.filter.call(
    document.querySelectorAll('main *, footer *'),
    function (el) {
      if (/^(SCRIPT|STYLE|SVG|PATH|IMG|PICTURE|SOURCE|BR|HR)$/i.test(el.tagName)) return false;
      if (el.closest('svg, [data-screen]') || isInline(el)) return false;
      if (!el.textContent.trim()) return false;
      return !Array.prototype.some.call(el.querySelectorAll('*'), function (c) {
        return !c.closest('svg') && !/^(BR)$/.test(c.tagName) && !isInline(c);
      });
    }
  );

  blocks.forEach(function (el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);

    // Scan backwards: skip trailing space, pass the last word, the space
    // before it, then find where the word before that starts
    var state = 0; // 0 trailing space, 1 last word, 2 gap, 3 second-to-last word
    var startNode = null, startOffset = 0;
    for (var i = nodes.length - 1; i >= 0 && state < 4; i--) {
      var d = nodes[i].data;
      for (var j = d.length - 1; j >= 0; j--) {
        var space = /\s/.test(d[j]);
        if (state === 0 && !space) state = 1;
        else if (state === 1 && space) state = 2;
        else if (state === 2 && !space) state = 3;
        else if (state === 3 && space) { startNode = nodes[i]; startOffset = j + 1; state = 4; break; }
        if (state === 3) { startNode = nodes[i]; startOffset = j; }
      }
    }
    if (state < 3 || !startNode) return; // fewer than two words
    // Only one line's worth of text before it? Then there's nothing to protect
    if (!/\S\s+\S/.test(el.textContent.trim().slice(0, -1))) return;

    // In a flex or grid box a wrapper span becomes its own item and the space
    // before it is dropped ("ProductDesigner"), so there just make the space
    // before the last word non-breaking instead.
    if (/flex|grid/.test(getComputedStyle(el).display)) {
      for (var a = nodes.length - 1; a >= 0; a--) {
        var t = nodes[a].data;
        var m = /\s+(?=\S*\s*$)/.exec(t.replace(/\s+$/, ''));
        if (m && m.index > 0) {
          nodes[a].data = t.slice(0, m.index) + '\u00a0' + t.slice(m.index + m[0].length);
          return;
        }
      }
      return;
    }

    var range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(el, el.childNodes.length);
    var keep = document.createElement('span');
    keep.className = 'nowrap';
    keep.appendChild(range.extractContents());
    range.insertNode(keep);
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

// Screens rebuilt in code are laid out at their real app size; scale each
// one to the width of its frame
(function () {
  var frames = document.querySelectorAll('[data-screen]');
  if (!frames.length) return;
  function fit(frame) {
    var screen = frame.firstElementChild;
    if (screen && frame.clientWidth) {
      frame.style.setProperty('--s', frame.clientWidth / screen.offsetWidth);
    }
  }
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (e) { fit(e.target); });
    });
    Array.prototype.forEach.call(frames, function (f) { ro.observe(f); });
  } else {
    Array.prototype.forEach.call(frames, fit);
    window.addEventListener('resize', function () { Array.prototype.forEach.call(frames, fit); });
  }
})();
