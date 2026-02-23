// ui.last_start_page.js
// P15.8: Remember last main page (Planning '/' or Calendar '/calendar') for post-login redirect.
// English-only code.

(function () {
  'use strict';

  function setCookie(name, value, maxAgeSeconds) {
    try {
      var parts = [];
      parts.push(encodeURIComponent(name) + '=' + encodeURIComponent(String(value || '')));
      parts.push('path=/');
      parts.push('samesite=lax');
      if (typeof maxAgeSeconds === 'number' && isFinite(maxAgeSeconds) && maxAgeSeconds > 0) {
        parts.push('max-age=' + Math.floor(maxAgeSeconds));
      }
      document.cookie = parts.join('; ');
    } catch (_) { /* no-op */ }
  }

  function remember() {
    var p = String(location.pathname || '/');
    if (p === '/' || p === '') {
      setCookie('last_main_page', 'planning', 31536000); // 365d
      return;
    }
    if (p === '/calendar' || p === '/calendar/') {
      setCookie('last_main_page', 'calendar', 31536000); // 365d
      return;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', remember, { once: true });
  } else {
    remember();
  }
})();
