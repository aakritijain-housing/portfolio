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
    function (img) { return !img.closest('a'); }
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

  function open(img) {
    opener = img;
    big.src = img.getAttribute('data-full') || img.currentSrc || img.src;
    big.alt = img.alt;
    // Phone screenshots fit the screen height instead of filling the width
    box.classList.toggle('lightbox--fit-height', !!img.closest('[data-fit="height"], .tabs__ba, .hero__phones'));
    // ...but small crops are not blown up beyond 1.5x their real size
    big.style.maxHeight = img.naturalHeight ? img.naturalHeight * 1.5 + 'px' : '';
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
