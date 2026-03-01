/* @version calendar-ui v2.3 */
(function () {
  'use strict';
  var THEME_KEY = 'ui-theme';
  var mqMobile = window.matchMedia('(max-width: 900px)');

  // Theme toggle button is available on all pages
  function isCabinetPage() {
    try {
      var p = (window.location && window.location.pathname) ? window.location.pathname : '';
      return (p === '/cabinet' || p === '/cabinet/');
    } catch (_) {
      return false;
    }
  }

  function prefersDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function readTheme() { return localStorage.getItem(THEME_KEY) || (prefersDark() ? 'dark' : 'light'); }
  function saveTheme(t) { localStorage.setItem(THEME_KEY, t); }
  function sunSvg() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.36 6.36-1.42-1.42M8.05 8.05 6.63 6.63m10.73 0-1.42 1.42M8.05 15.95 6.63 17.37"/></svg>'; }
  function moonSvg() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'; }
  function updateThemeIcon() {
    var el = document.getElementById('themeToggle'); if (!el) return;
    var t = document.documentElement.getAttribute('data-theme') || 'light';
    el.innerHTML = (t === 'dark') ? sunSvg() : moonSvg();
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', (t === 'dark') ? 'dark' : 'light');
    updateThemeIcon();
  }

  function ensureFAB() {
    if (!document.getElementById('themeToggle')) {
      var t = document.createElement('button');
      t.id = 'themeToggle'; t.className = 'ui-fab theme'; t.type = 'button'; t.title = 'Тема';
      t.setAttribute('aria-label', 'Тема'); document.body.appendChild(t);
      t.innerHTML = (readTheme() === 'dark') ? sunSvg() : moonSvg();
    }
  }

  function app_init() {
    ensureFAB();
    applyTheme(readTheme());
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'light';
      var next = (cur === 'dark') ? 'light' : 'dark';
      saveTheme(next); applyTheme(next);
    });

    console.debug('UI ready (v2.3)');
  }


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app_init);
  } else {
    app_init();
  }
})();


// Safe time parsing: supports "HH:MM" and ignores ISO date prefixes
// ---------- date/time helpers ----------
function parseDayKey(dk) {
  var p = String(dk || "").split("-").map(function (x) { return parseInt(x, 10) || 0; });
  return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1, 0, 0, 0, 0);
}

function parseHoursMinutes(s) {
  var str = String(s || "");
  var m = str.match(/(\d{1,2}):(\d{2})/);
  var h = m ? parseInt(m[1], 10) : 0;
  var min = m ? parseInt(m[2], 10) : 0;
  if (!isFinite(h)) h = 0;
  if (!isFinite(min)) min = 0;
  return [h, min];
}

function toDate(dk, timeStr) {
  var d = parseDayKey(dk);
  var hm = parseHoursMinutes(timeStr);
  d.setHours(hm[0], hm[1], 0, 0);
  return d;
}

function keyFromDateLocal(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function formatTime(d) {
  var h = String(d.getHours()).padStart(2, "0");
  var m = String(d.getMinutes()).padStart(2, "0");
  return h + ":" + m;
}

// ---------- UA date display helpers (single include) ----------
function formatDateUA(d) {
  var weekdays = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var monthsGen = [
    'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
  ];
  var dow = weekdays[d.getDay()];
  var dd = String(d.getDate()).padStart(2, '0');
  var mon = monthsGen[d.getMonth()];
  var yyyy = d.getFullYear();
  return dow + ', ' + dd + ' ' + mon + ' ' + yyyy;
}

function toUADisplayDate(dateLike) {
  if (dateLike instanceof Date && !isNaN(dateLike)) return formatDateUA(dateLike);
  var d = new Date(dateLike);
  return isNaN(d) ? String(dateLike || '') : formatDateUA(d);
}

// DOM посилання
function $(id) { return document.getElementById(id); }
function $id(id) { return document.getElementById(id); }

var __stableScrollRestoreToken = 0;

function withStableScroll(fn) {
  var x = 0, y = 0;
  try {
    x = Math.max(0, window.scrollX || 0);
    y = Math.max(0, window.scrollY || 0);
  } catch (_) { }

  var token = (++__stableScrollRestoreToken);

  function __restoreScrollIfCurrent() {
    if (token !== __stableScrollRestoreToken) return;
    try { window.scrollTo(x, y); } catch (_) { }
  }

  try { fn && fn(); } catch (e) { console.warn('withStableScroll failed', e); }

  __restoreScrollIfCurrent();
  try { requestAnimationFrame(__restoreScrollIfCurrent); } catch (_) { }
  try { setTimeout(__restoreScrollIfCurrent, 0); } catch (_) { }
  try { setTimeout(__restoreScrollIfCurrent, 120); } catch (_) { }
  try { setTimeout(__restoreScrollIfCurrent, 320); } catch (_) { }
}


/**
 * Overdue:
 * - Закриті (close_user_id/close_time) або done — НІКОЛИ не прострочені
 * - Single-day: start < today  або (start == today && time < now)
 * - Multi-day:  start < today  І end < today
 *
 * Старт шукаємо у: _startDay > start_date > day > dateISO > date
 */
function isEventOverdueStrict(ev, todayISO, nowHM) {
  try {
    if (!ev) return false;

    // закриті / done — не прострочені
    if ((typeof isEventClosed === 'function' && isEventClosed(ev)) || ev.done) return false;

    // утиліти
    function pad2(n) { return ('0' + n).slice(-2); }
    function dayKey(src) {
      if (!src) return '';
      if (src instanceof Date) {
        return src.getFullYear() + '-' + pad2(src.getMonth() + 1) + '-' + pad2(src.getDate());
      }
      var s = String(src).slice(0, 10);         // очікуємо YYYY-MM-DD
      var a = s.split('-');
      var d = new Date(+a[0] || 0, (+a[1] || 1) - 1, +a[2] || 1);
      if (isNaN(d.getTime())) return '';
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }
    function toMin(hm) {
      if (hm === null || hm === undefined) return null;
      var s = String(hm).trim().replace('.', ':'); // підтримка "9.00"
      if (!s) return null;
      var p = s.split(':'), h = parseInt(p[0], 10), m = parseInt(p[1] || '0', 10);
      if (isNaN(h)) h = 0; if (isNaN(m)) m = 0;
      if (m > 59) m = 59; if (m < 0) m = 0; if (h < 0) h = 0;
      return h * 60 + m;
    }

    var todayK = dayKey(todayISO || new Date());

    // Визначаємо реальний старт/фініш
    var startSrc = ev._startDay || ev.start_date || ev.day || ev.dateISO || ev.date || null;
    var endSrc = ev.end_date || ev.finish || ev.end || null;

    var startK = dayKey(startSrc);
    var endK = dayKey(endSrc);
    var isMulti = !!endK && endK !== startK;

    // Мульти: прострочена лише якщо ОБИДВІ дати у минулому
    if (isMulti) {
      if (!startK || !endK) return false;
      return (startK < todayK) && (endK < todayK);
    }

    // Одноденна
    if (!startK) return false;
    if (startK < todayK) return true;
    if (startK > todayK) return false;

    // Сьогодні: перевіряємо час
    var tMin = toMin(ev.time);
    if (tMin === null) return false; // без часу — до кінця дня не вважаємо простроченою
    var nowMin = toMin(nowHM || (function () { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); })());
    if (nowMin === null) return false;
    return nowMin > tMin;
  } catch (_) { return false; }
}