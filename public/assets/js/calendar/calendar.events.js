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
    return function (ev) {
      var typeOk = (t === 'all') || (ev.type === t);
      if (!q) return typeOk;
      var hay = norm(((ev.title || '') + ' ' + (ev.owner || '')));
      return typeOk && hay.indexOf(q) !== -1;
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
