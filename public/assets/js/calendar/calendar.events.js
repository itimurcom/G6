/* calendar.events.js — доменна логіка «подій» (без DOM) */
(function (global) {
  "use strict";

  function genId() {
    if (window.crypto && window.crypto.getRandomValues) {
      return 'e_' + Array.from(window.crypto.getRandomValues(new Uint8Array(8))).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    return 'e_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function typeToClass(t) {
    return t === 'mi' ? 'type-mi' : t === 'nas' ? 'type-nas' : t === 'evt' ? 'type-evt' : 'type-other';
  }

  function labelForType(t) {
    return t === 'mi' ? 'ТЛГ: МИ' : t === 'nas' ? 'ТЛГ: НАС' : t === 'evt' ? 'Захід' : 'Інше';
  }

  function findIndexById(arr, id) {
    for (var i = 0; i < (arr || []).length; i++) { if (arr[i] && arr[i].id === id) return i; } return -1;
  }

  function defaultTime() {
    var d = new Date(); d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function pad2(n) {
    return ('0' + n).slice(-2);
  }

  function toISODate(d) {
    var y = d.getFullYear();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var da = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + da;
  }

  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>\"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; });
  }

  function norm(s) {
    s = (s == null ? '' : String(s)).toLowerCase();
    var out = '', prev = false, i, ch, code;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i); code = ch.charCodeAt(0);
      if (code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32) {
        if (!prev) { out += ' '; prev = true; }
      } else { out += ch; prev = false; }
    }
    if (out.charAt(0) === ' ') out = out.slice(1);
    if (out.charAt(out.length - 1) === ' ') out = out.slice(0, -1);
    return out;
  }

  function formatISO(iso) {
    var d = new Date(iso);
    return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  }

  // Побудова предикату фільтру за типом і текстом
  function buildMatcher(currentType, query) {
    var q = norm(query || '');
    var t = currentType || 'all';

    // Optional hook to check "overdue" state without hard coupling:
    var overdueFn = (global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.isEventOverdueStrict)
      || (typeof isEventOverdueStrict === 'function' && isEventOverdueStrict) || null;

    // Fallback local overdue check (mirrors ui/app.js logic) in case the hook isn't available
    function isOverdueLocal(ev, todayISO, nowHM) {
      try {
        if (!ev) return false;
        // closed/done are never overdue
        if ((typeof global.CalendarApp !== 'undefined'
              && global.CalendarApp && global.CalendarApp.ui
              && typeof global.CalendarApp.ui.isEventClosed === 'function'
              && global.CalendarApp.ui.isEventClosed(ev)) || ev.done) return false;

        function pad2(n) { return ('0' + n).slice(-2); }
        function dayKey(src) {
          if (!src) return '';
          if (src instanceof Date) {
            return src.getFullYear() + '-' + pad2(src.getMonth() + 1) + '-' + pad2(src.getDate());
          }
          var s = String(src).slice(0, 10);
          var a = s.split('-');
          if (a.length === 3) return a[0] + '-' + pad2(a[1]) + '-' + pad2(a[2]);
          return s;
        }
        function toMin(hhmm) {
          if (!hhmm) return null;
          var a = String(hhmm).split(':');
          if (a.length < 2) return null;
          var h = parseInt(a[0], 10), m = parseInt(a[1], 10);
          if (isNaN(h) || isNaN(m)) return null;
          return h * 60 + m;
        }

        var startK = dayKey(ev._startDay || ev.start_date || ev.day || ev.dateISO || ev.date);
        var endK = dayKey(ev._endDay || ev.end_date || ev.day_end || ev.date_to);
        var todayK = dayKey(todayISO || new Date());
        var isMulti = !!(endK && startK && endK !== startK);

        if (isMulti) {
          if (!startK || !endK) return false;
          return (startK < todayK) && (endK < todayK);
        }
        if (!startK) return false;
        if (startK < todayK) return true;
        if (startK > todayK) return false;

        var tMin = toMin(ev.time);
        if (tMin === null) return false;
        var nowMin = toMin(nowHM);
        if (nowMin === null) return false;
        return nowMin > tMin;
      } catch (_) { return false; }
    }

    // Precompute "today" and "now" once per matcher
    function pad2(n) { return ('0' + n).slice(-2); }
    var now = new Date();
    var todayISO = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
    var nowHM = pad2(now.getHours()) + ':' + pad2(now.getMinutes());

    return function (ev) {
      var pass;
      if (t === 'overdue') {
        var fn = overdueFn || isOverdueLocal;
        pass = !!fn(ev, todayISO, nowHM);
      } else {
        pass = (t === 'all') || (ev.type === t);
      }
      if (!pass) return false;

      if (!q) return true;
      var hay = norm(((ev.title || '') + ' ' + (ev.owner || '')));
      return hay.indexOf(q) !== -1;
    };
  }

  // Нормалізація/міграція масиву подій (ID, user_id)
  function migrateArray(arr) {
    var changed = false;
    arr = Array.isArray(arr) ? arr : [];
    for (var i = 0; i < arr.length; i++) {
      if (!arr[i].id) { arr[i].id = genId(); changed = true; }
      if (typeof arr[i].user_id === 'undefined') { arr[i].user_id = 0; changed = true; }
    }
    return { list: arr, changed: changed };
  }

  // Оновлення часу однієї події в масиві
  function updateEventTimeInArray(arr, id, newTime) {
    var idx = findIndexById(arr, id);
    if (idx === -1) return arr;
    var copy = arr.slice();
    copy[idx] = Object.assign({}, copy[idx], { time: newTime });
    return copy;
  }

  global.CalendarApp = global.CalendarApp || {};
  global.CalendarApp.events = {
    genId,
    typeToClass,
    labelForType,
    findIndexById,
    defaultTime,
    pad2,
    toISODate,
    sameDate,
    escapeHtml,
    norm,
    formatISO,
    buildMatcher,
    migrateArray,
    updateEventTimeInArray
  };
})(window);
