/* Sidebar (hamburger) UI — global, no dependencies */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function closest(el, sel) {
    while (el && el !== document.documentElement) {
      if (el.matches && el.matches(sel)) return el;
      el = el.parentElement;
    }
    return null;
  }

  ready(function () {
    var toggle = document.getElementById('sidebarToggle');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');

    if (!toggle || !sidebar || !overlay) return;

    function isOpen() {
      return document.body.classList.contains('sidebar-open');
    }

    function open() {
      if (isOpen()) return;
      document.body.classList.add('sidebar-open');
      sidebar.classList.add('sidebar--open');
      overlay.classList.add('sidebar-overlay--open');
      sidebar.setAttribute('aria-hidden', 'false');
      overlay.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');

      // Focus first link for keyboard users
      var firstLink = sidebar.querySelector('a.sidebar-link');
      if (firstLink && firstLink.focus) {
        try { firstLink.focus({ preventScroll: true }); } catch (_) { firstLink.focus(); }
      }
    }

    function close() {
      if (!isOpen()) return;
      document.body.classList.remove('sidebar-open');
      sidebar.classList.remove('sidebar--open');
      overlay.classList.remove('sidebar-overlay--open');
      sidebar.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');

      // Return focus to the toggle
      if (toggle && toggle.focus) {
        try { toggle.focus({ preventScroll: true }); } catch (_) { toggle.focus(); }
      }
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) close(); else open();
    });

    overlay.addEventListener('click', function () {
      close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    // Close by clicking any element marked as data-sidebar-close
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;

      var closer = closest(t, '[data-sidebar-close]');
      if (closer) {
        e.preventDefault();
        close();
        return;
      }

      // Close after selecting a menu item (allow navigation)
      var link = closest(t, '#sidebar a.sidebar-link');
      if (link) {
        close();
      }
    });

    // Expose for debugging
    window.SidebarUI = { open: open, close: close };
  });
})();
