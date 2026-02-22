// ui.toast.js — lightweight global toast (NOT activity/notify)
// P15.7: cabinet password change success uses this toast to avoid duplicate alerts
(function (global) {
  'use strict';

  function $id(id) { return document.getElementById(id); }

  function ensureToast() {
    var t = $id('uiToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'uiToast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.style.cssText = [
        'position:fixed',
        'bottom:16px',
        'left:50%',
        'transform:translateX(-50%) translateY(8px)',
        'z-index:99999',
        'display:inline-flex',
        'align-items:center',
        'gap:8px',
        'padding:8px 12px',
        'border:1px solid var(--border)',
        'background:var(--event-bg)',
        'color:var(--fg)',
        'border-radius:999px',
        'font-size:13px',
        'font-weight:800',
        'box-shadow:0 8px 20px rgba(0,0,0,.12)',
        'opacity:0',
        'pointer-events:none',
        'transition:opacity .25s ease, transform .25s ease'
      ].join(';');

      var ico = document.createElement('span');
      ico.id = 'uiToastIcon';
      ico.textContent = 'ℹ️';

      var txt = document.createElement('span');
      txt.id = 'uiToastText';
      txt.textContent = '';

      t.appendChild(ico);
      t.appendChild(txt);
      document.body.appendChild(t);
    }
    return t;
  }

  function setMode(mode) {
    var t = ensureToast();
    var ico = $id('uiToastIcon');

    // reset
    t.style.borderColor = 'var(--border)';
    t.style.boxShadow = '0 8px 20px rgba(0,0,0,.12)';
    t.style.color = 'var(--fg)';
    t.style.background = 'var(--event-bg)';

    if (mode === 'success') {
      t.style.background = 'var(--type-evt)';
      t.style.borderColor = 'var(--type-evt)';
      t.style.color = '#fff';
      t.style.boxShadow = '0 8px 24px rgba(34,197,94,.28)';
      if (ico) ico.textContent = '✅';
    } else if (mode === 'error') {
      t.style.background = 'var(--urgent)';
      t.style.borderColor = 'var(--urgent)';
      t.style.color = '#fff';
      t.style.boxShadow = '0 8px 24px rgba(239,68,68,.28)';
      if (ico) ico.textContent = '⚠️';
    } else {
      if (ico) ico.textContent = 'ℹ️';
    }
  }

  function toastShow() {
    var t = ensureToast();
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  }

  function toastHide() {
    var t = ensureToast();
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(8px)';
  }

  var _timer = null;
  function show(msg, mode, autoHideMs) {
    ensureToast();
    setMode(mode);
    $id('uiToastText').textContent = String(msg || '');
    toastShow();

    if (_timer) { clearTimeout(_timer); _timer = null; }
    var ms = (typeof autoHideMs === 'number' && autoHideMs >= 0) ? autoHideMs : 1400;
    if (ms > 0) {
      _timer = setTimeout(function () { toastHide(); }, ms);
    }
  }

  global.UiToast = {
    show: show,
    success: function (msg, ms) { show(msg, 'success', ms); },
    error: function (msg, ms) { show(msg, 'error', ms); },
    info: function (msg, ms) { show(msg, 'info', ms); },
    hide: toastHide
  };
})(window);
