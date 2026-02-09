/* calendar.ui.notify.js — sticky notifications (activity toast stack)
   - polls server: GET /api/notify/unseen
   - shows persistent notifications in bottom-right until marked as viewed
   - optional sound (toggle)
*/

(function (global) {
  "use strict";

  
  // Prevent double-loading (layout may include the script more than once)
  if (global.__CAL_NOTIFY_LOADED) return;
  global.__CAL_NOTIFY_LOADED = true;
var Data = (global.CalendarApp && global.CalendarApp.data) || null;
  var Ev = (global.CalendarApp && global.CalendarApp.events) || null;

  var KEY_SOUND = 'calendar.notify.sound';
  var KEY_COLLAPSED = 'calendar.notify.collapsed';

  var audioCtx = null;
  var soundEnabled = true;

  var stackRoot = null;
  var listEl = null;
  var titleCountEl = null;
  var btnSound = null;
  var btnClear = null;
  var btnCollapse = null;

  // key -> element (key is notification.id when available; otherwise event_id+kind)
  var byKey = Object.create(null);
  // event_id|kind -> key (to replace local placeholder with real notification id without duplicating UI)
  var byEventKind = Object.create(null);

  var POLL_MS = 7000; // 7s
  var pollTimer = null;
  var inFlight = false;

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { }
  }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    var Ctx = global.AudioContext || global.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function playBeep() {
    if (!soundEnabled) return;
    var ctx = ensureAudio();
    if (!ctx) return;

    // Try to unlock if suspended (may fail without user gesture)
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (_) { }
    }

    try {
      var t0 = ctx.currentTime;
      var o = ctx.createOscillator();
      var g = ctx.createGain();

      o.type = 'sine';
      o.frequency.setValueAtTime(880, t0);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);

      o.connect(g);
      g.connect(ctx.destination);

      o.start(t0);
      o.stop(t0 + 0.18);
    } catch (_) { }
  }


  function svgIconBell() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>'
      + '<path d="M13.73 21a2 2 0 01-3.46 0"></path>'
      + '</svg>';
  }

  function svgIconBellOff() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>'
      + '<path d="M13.73 21a2 2 0 01-3.46 0"></path>'
      + '<path d="M4 4l16 16"></path>'
      + '</svg>';
  }

  function svgIconMarkAll() {
    // Proposed design: "double check" icon (mark all as viewed)
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M7 12l2 2 4-4"></path>'
      + '<path d="M13 12l2 2 4-4"></path>'
      + '</svg>';
  }

  function svgIconMarkOne() {
    // Single "viewed" icon (check)
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M20 6L9 17l-5-5"></path>'
      + '</svg>';
  }

  function svgIconChevronDown() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M6 9l6 6 6-6"/>'
      + '</svg>';
  }

  function svgIconChevronUp() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M6 15l6-6 6 6"/>'
      + '</svg>';
  }


  function setBtnSvg(btn, svg) {
    if (!btn) return;
    btn.innerHTML = svg;
  }

  function fmtDate(iso) {
    try {
      if (!Ev || typeof Ev.formatISO !== 'function') return String(iso || '');
      return Ev.formatISO(String(iso || ''));
    } catch (_) {
      return String(iso || '');
    }
  }

  function labelForType(t) {
    try {
      if (Ev && typeof Ev.labelForType === 'function') return Ev.labelForType(t);
    } catch (_) { }
    if (t === 'mi') return 'ТЛГ: МИ';
    if (t === 'nas') return 'ТЛГ: НАС';
    if (t === 'evt') return 'Захід';
    return 'Інше';
  }

  

  // Open event:
  // - On Calendar page: open modal by (dateISO, id). If the event is not in cache yet — load store first.
  // - On other pages: store pending {date,id} and navigate to /calendar
  var KEY_PENDING_OPEN = 'calendar.pendingOpenEvent';

  function openEvent(dateISO, eventId) {
    var d = String(dateISO || '');
    var eid = String(eventId || '');
    if (!eid || !d) return;

    try {
      var ui = (global.CalendarApp && global.CalendarApp.ui) ? global.CalendarApp.ui : null;
      var data = (global.CalendarApp && global.CalendarApp.data) ? global.CalendarApp.data : null;

      if (ui && typeof ui.openInfo === 'function') {
        // If the event isn't in current cache — load store and retry.
        try {
          if (data && typeof data.getEventsFor === 'function') {
            var arr = data.getEventsFor(d) || [];
            var has = false;
            for (var i = 0; i < arr.length; i++) {
              if (arr[i] && String(arr[i].id || '') === eid) { has = true; break; }
            }
            if (!has && typeof data.serverLoadStore === 'function' && typeof data._setCache === 'function') {
              data.serverLoadStore()
                .then(function (cache) {
                  try { data._setCache(cache); } catch (_) { }
                })
                .catch(function () { /* ignore */ })
                .then(function () {
                  try { ui.openInfo(d, eid); } catch (_) { }
                });
              return;
            }
          }
        } catch (_) { }

        try { ui.openInfo(d, eid); } catch (_) { }
        return;
      }
    } catch (_) { }

    // Fallback: go to calendar and open after load
    try { localStorage.setItem(KEY_PENDING_OPEN, JSON.stringify({ date: d, id: eid })); } catch (_) { }
    try { global.location.href = '/calendar'; } catch (_) { }
  }

  // If user clicked "open" on another page, consume pending info on Calendar page
  function tryConsumePendingOpen() {
    var raw = '';
    try { raw = localStorage.getItem(KEY_PENDING_OPEN) || ''; } catch (_) { raw = ''; }
    if (!raw) return;

    var p = null;
    try { p = JSON.parse(raw); } catch (_) { p = null; }
    var d = (p && p.date) ? String(p.date) : '';
    var eid = (p && p.id) ? String(p.id) : '';

    if (!d || !eid) {
      try { localStorage.removeItem(KEY_PENDING_OPEN); } catch (_) { }
      return;
    }

    var tries = 0;
    var t = global.setInterval(function () {
      tries++;
      try {
        var ui = (global.CalendarApp && global.CalendarApp.ui) ? global.CalendarApp.ui : null;
        var data = (global.CalendarApp && global.CalendarApp.data) ? global.CalendarApp.data : null;

        if (ui && typeof ui.openInfo === 'function') {
          // Ensure cache contains event
          var openNow = function () {
            try { ui.openInfo(d, eid); } catch (_) { }
          };

          try {
            if (data && typeof data.getEventsFor === 'function') {
              var arr = data.getEventsFor(d) || [];
              var has = false;
              for (var i = 0; i < arr.length; i++) {
                if (arr[i] && String(arr[i].id || '') === eid) { has = true; break; }
              }
              if (!has && typeof data.serverLoadStore === 'function' && typeof data._setCache === 'function') {
                data.serverLoadStore()
                  .then(function (cache) { try { data._setCache(cache); } catch (_) { } })
                  .catch(function () { /* ignore */ })
                  .then(function () { openNow(); });
              } else {
                openNow();
              }
            } else {
              openNow();
            }
          } catch (_) { openNow(); }

          global.clearInterval(t);
          try { localStorage.removeItem(KEY_PENDING_OPEN); } catch (_) { }
          return;
        }
      } catch (_) { }

      if (tries >= 80) { // ~4s max
        global.clearInterval(t);
      }
    }, 50);
  }

  function makeKey(notif) {
    try {
      var nid = notif && (notif.id !== undefined && notif.id !== null) ? String(notif.id) : '';
      if (nid) return 'n:' + nid;
    } catch (_) { }
    var eid = String((notif && (notif.event_id || (notif.event && notif.event.id))) || '');
    var kind = String((notif && notif.kind) || 'event_new');
    return 'e:' + eid + ':' + kind;
  }

  function makeEventKindKey(eid, kind) {
    return String(eid || '') + '|' + String(kind || '');
  }

  function parsePayloadMaybe(v) {
    if (!v) return null;
    if (typeof v === 'object') return v;
    if (typeof v !== 'string') return null;
    try { return JSON.parse(v); } catch (_) { return null; }
  }

  function extractEventLike(notif) {
    if (!notif) return null;
    if (notif.event && typeof notif.event === 'object') return notif.event;

    var p = parsePayloadMaybe(notif.payload);
    if (!p) return null;

    // common payload formats
    if (p.event && typeof p.event === 'object') return p.event;
    if (p.after && typeof p.after === 'object') return p.after;
    if (p.before && typeof p.before === 'object') return p.before;

    // snapshot directly
    if (p.title || p.start_date || p.type || p.time) return p;

    return null;
  }

  function extractEventId(notif, ev) {
    var eid = String((ev && ev.id) || (notif && notif.event_id) || '');
    return eid;
  }

  function extractType(notif, ev) {
    return String((ev && ev.type) || (notif && notif.type) || 'other');
  }

  function extractDateISO(notif, ev) {
    return String((ev && (ev.start_date || ev._date)) || (notif && notif.date) || '');
  }

  function extractTime(ev) {
    return String((ev && (ev.time || ev.start_time)) || '');
  }

  function messageForKind(notif, ev) {
    var kind = String((notif && notif.kind) || 'event_new');

    if (kind === 'event_new') return 'Додано нову подію.';
    if (kind === 'event_deleted') return 'Подію видалено.';
    if (kind === 'event_date_changed') return 'Змінено дату події.';

    if (kind === 'event_done_changed') {
      var p = parsePayloadMaybe(notif && notif.payload) || null;
      try {
        if (p && (p.from_done !== undefined) && (p.to_done !== undefined)) {
          var fd = String(p.from_done) === '1' || p.from_done === true;
          var td = String(p.to_done) === '1' || p.to_done === true;
          if (!fd && td) return 'Позначено як виконано.';
          if (fd && !td) return 'Знято позначку «Виконано».';
        }
      } catch (_) { }
      return 'Змінено статус «Виконано».';
    }

    if (kind === 'event_urgent_changed') {
      var p2 = parsePayloadMaybe(notif && notif.payload) || null;
      try {
        if (p2 && (p2.from_urgent !== undefined) && (p2.to_urgent !== undefined)) {
          var fu = String(p2.from_urgent) === '1' || p2.from_urgent === true;
          var tu = String(p2.to_urgent) === '1' || p2.to_urgent === true;
          if (!fu && tu) return 'Позначено як термінову.';
          if (fu && !tu) return 'Знято позначку «Термінова».';
        }
      } catch (_) { }
      return 'Змінено терміновість події.';
    }

    if (kind === 'event_title_changed') return 'Змінено назву події.';
    if (kind === 'event_owner_changed') return 'Змінено виконавця.';

    if (kind === 'event_docs_changed') {
      var p3 = parsePayloadMaybe(notif && notif.payload) || null;
      try {
        var bi = p3 ? String(p3.from_in || '') : '';
        var ai = p3 ? String(p3.to_in || '') : '';
        var bo = p3 ? String(p3.from_out || '') : '';
        var ao = p3 ? String(p3.to_out || '') : '';

        var cin = bi.trim() !== ai.trim();
        var cout = bo.trim() !== ao.trim();

        if (cin && cout) return 'Змінено номери вхідного та вихідного документів.';
        if (cin) return 'Змінено номер вхідного документа.';
        if (cout) return 'Змінено номер вихідного документа.';
      } catch (_) { }
      return 'Змінено номери документів.';
    }

    return 'Оновлено подію.';
  }

  function makeIconSvgByType(type) {
    // stroke-based icons (white via CSS currentColor)
    type = String(type || 'other');

    // event / "Захід"
    if (type === 'evt') {
      return '' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8 2v3M16 2v3M3 9h18M5 6h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m9.5 14 1.7 1.7 3.8-3.8"/>' +
        '</svg>';
    }

    // TLG:MI (single user)
    if (type === 'mi') {
      return '' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 21a8 8 0 0 0-16 0"/>' +
        '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>' +
        '</svg>';
    }

    // TLG:NAS (group)
    if (type === 'nas') {
      return '' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 21a6 6 0 0 0-12 0"/>' +
        '<circle cx="11" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 21a5 5 0 0 0-7-4"/>' +
        '<circle cx="18" cy="8" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
        '</svg>';
    }

    // other / default
    return '' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M5 12h.01M12 12h.01M19 12h.01"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0"/>' +
      '</svg>';
  }

  function updateCount() {
    if (!titleCountEl) return;

    var n = 0;
    try { n = listEl ? (listEl.children ? listEl.children.length : 0) : 0; } catch (_) { n = 0; }
    titleCountEl.textContent = n ? ('(' + n + ')') : '';

    // Requirement: hide notification block when there are no messages
    if (stackRoot) {
      try {
        if (n === 0) stackRoot.setAttribute('hidden', 'hidden');
        else stackRoot.removeAttribute('hidden');
      } catch (_) { }
    }
  }

  function ensureUI() {
    if (stackRoot) return;

    // Restore settings
    var s = safeGet(KEY_SOUND);
    if (s === '0') soundEnabled = false;

    var collapsed = (safeGet(KEY_COLLAPSED) === '1');

    stackRoot = document.createElement('div');
    stackRoot.id = 'notifStack';

    var shell = document.createElement('div');
    shell.className = 'notif-shell';

    var head = document.createElement('div');
    head.className = 'notif-head';

    var title = document.createElement('div');
    title.className = 'notif-title';
    title.innerHTML = '<span class="notif-title-word" style="font-size: 18px; font-weight: 900;">Активність</span> <span class="notif-count" id="notifCount"></span>';
    titleCountEl = title.querySelector('#notifCount');

    var actions = document.createElement('div');
    actions.className = 'notif-actions';

    btnCollapse = document.createElement('button');
    btnCollapse.type = 'button';
    btnCollapse.className = 'notif-iconbtn';
    btnCollapse.title = collapsed ? 'Розгорнути' : 'Згорнути';
    btnCollapse.setAttribute('aria-label', btnCollapse.title);
    setBtnSvg(btnCollapse, collapsed ? svgIconChevronUp() : svgIconChevronDown());

    btnSound = document.createElement('button');
    btnSound.type = 'button';
    btnSound.className = 'notif-iconbtn';
    btnSound.title = soundEnabled ? 'Звук: увімкнено' : 'Звук: вимкнено';
    btnSound.setAttribute('aria-label', btnSound.title);
    setBtnSvg(btnSound, soundEnabled ? svgIconBell() : svgIconBellOff());

    btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'notif-iconbtn';
    btnClear.title = 'Відмітити всі як переглянуті';
    btnClear.setAttribute('aria-label', 'Відмітити всі повідомлення як переглянуті');
    setBtnSvg(btnClear, svgIconMarkAll());

    actions.appendChild(btnCollapse);
    actions.appendChild(btnSound);
    actions.appendChild(btnClear);

    head.appendChild(title);
    head.appendChild(actions);

    listEl = document.createElement('div');
    listEl.className = 'notif-list';

    shell.appendChild(head);
    shell.appendChild(listEl);

    // collapsed state
    if (collapsed) {
      listEl.style.display = 'none';
    }

    stackRoot.appendChild(shell);
    document.body.appendChild(stackRoot);

    btnSound.addEventListener('click', function () {
      soundEnabled = !soundEnabled;
      safeSet(KEY_SOUND, soundEnabled ? '1' : '0');
      btnSound.title = soundEnabled ? 'Звук: увімкнено' : 'Звук: вимкнено';
      btnSound.setAttribute('aria-label', btnSound.title);
      setBtnSvg(btnSound, soundEnabled ? svgIconBell() : svgIconBellOff());

      // user gesture: unlock audio
      if (soundEnabled) {
        try {
          var ctx = ensureAudio();
          if (ctx && ctx.state === 'suspended') ctx.resume();
        } catch (_) { }
        playBeep();
      }
    });

    btnClear.addEventListener('click', function () {
      markSeenAll().then(function (ok) {
        if (!ok) {
          try { console.warn('[notify] seen-all failed'); } catch (_) { }
          return;
        }
        try {
          if (listEl) listEl.innerHTML = '';
          for (var k in byKey) { if (Object.prototype.hasOwnProperty.call(byKey, k)) delete byKey[k]; }
          for (var ek in byEventKind) { if (Object.prototype.hasOwnProperty.call(byEventKind, ek)) delete byEventKind[ek]; }
        } catch (_) { }
        updateCount();
        try { setTimeout(fetchUpdates, 300); } catch (_) { }
      });
    });

    btnCollapse.addEventListener('click', function () {
      var isCollapsed = (listEl.style.display === 'none');
      if (isCollapsed) {
        listEl.style.display = '';
        setBtnSvg(btnCollapse, svgIconChevronDown());
        btnCollapse.title = 'Згорнути';
        safeSet(KEY_COLLAPSED, '0');
      } else {
        listEl.style.display = 'none';
        setBtnSvg(btnCollapse, svgIconChevronUp());
        btnCollapse.title = 'Розгорнути';
        safeSet(KEY_COLLAPSED, '1');
      }
      btnCollapse.setAttribute('aria-label', btnCollapse.title);
    });

    updateCount();
  }

  function bumpExisting(key) {
    var el = byKey[String(key || '')];
    if (!el) return;

    try {
      if (listEl && el.parentNode === listEl) {
        listEl.insertBefore(el, listEl.firstChild);
      }
    } catch (_) { }

    try {
      el.classList.add('is-bump');
      setTimeout(function () {
        try { el.classList.remove('is-bump'); } catch (_) { }
      }, 900);
    } catch (_) { }
  }

  function removeItem(key) {
    var k = String(key || '');
    var el = byKey[k];
    if (!el) return;

    // cleanup event-kind mapping if it points to this key
    try {
      var eid = String(el.dataset.eventId || '');
      var kind = String(el.dataset.kind || '');
      var ek = makeEventKindKey(eid, kind);
      if (byEventKind[ek] === k) delete byEventKind[ek];
    } catch (_) { }

    try { if (el.parentNode) el.parentNode.removeChild(el); } catch (_) { }
    try { delete byKey[k]; } catch (_) { }
    updateCount();
  }

  function markSeen(notif) {
    var nid = '';
    try { nid = (notif && (notif.id !== undefined && notif.id !== null)) ? String(notif.id) : ''; } catch (_) { nid = ''; }

    var eid = String((notif && notif.event_id) || '');
    var kind = String((notif && notif.kind) || 'event_new');

    var body = null;
    if (nid) body = { id: nid };
    else body = { event_id: eid, kind: kind };

    return fetch('/api/notify/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    })
      .then(function (r) { return r.ok ? r.json().catch(function(){ return null; }) : null; })
      .then(function (p) { return !!(p && p.ok === true); })
      .catch(function () { return false; });
  }

  function markSeenAll() {
    return fetch('/api/notify/seen-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(function (r) { return r.ok ? r.json().catch(function(){ return null; }) : null; })
      .then(function (p) { return !!(p && p.ok === true); })
      .catch(function () { return false; });
  }

  function addNotifyToast(notif, suppressBeep) {
    ensureUI();
    if (!listEl) return false;

    var ev = extractEventLike(notif);
    var eid = extractEventId(notif, ev);
    if (!eid) return false;

    var kind = String((notif && notif.kind) || 'event_new');
    var key = makeKey(notif);

    // Replace placeholder (event_id|kind) with real notification.id to avoid duplicates
    var ek = makeEventKindKey(eid, kind);
    var prevKey = byEventKind[ek];
    if (prevKey && prevKey !== key) {
      suppressBeep = true;
      removeItem(prevKey);
    }

    if (byKey[key]) {
      bumpExisting(key);
      updateCount();
      return false;
    }

    var type = extractType(notif, ev);
    var dateISO = extractDateISO(notif, ev);
    var time = extractTime(ev);
    var titleStr = (ev && ev.title) ? String(ev.title) : 'Подія';

    // Build item
    var item = document.createElement('div');
    item.className = 'notif-item';
    item.dataset.key = key;
    item.dataset.eventId = eid;
    item.dataset.kind = kind;
    item.dataset.date = String(dateISO || '');
    item.dataset.type = String(type || 'other');

    var row = document.createElement('div');
    row.className = 'notif-row';

    var ttl = document.createElement('div');
    ttl.className = 'notif-item-title';

    var titleText;
    // Title becomes a link (works on all pages):
    // - On Calendar page: opens modal directly
    // - On other pages: navigates to /calendar and opens after load
    var canOpenTitle = (kind !== 'event_deleted') && !!eid;
    if (canOpenTitle) {
      titleText = document.createElement('a');
      titleText.className = 'notif-item-title-link notif-link';
      titleText.href = '#';
      titleText.textContent = titleStr;
      titleText.addEventListener('click', function (evClick) {
        evClick.preventDefault();
        openEvent(dateISO, eid);
      });
    } else {
      titleText = document.createElement('div');
      titleText.textContent = titleStr;
    }
var subtitle = document.createElement('small');
    var when = [];
    if (dateISO) when.push(fmtDate(dateISO));
    if (time) when.push(time);
    if (type) when.push(labelForType(type));
    subtitle.textContent = when.join(' • ');

    ttl.appendChild(titleText);
    ttl.appendChild(subtitle);
    row.appendChild(ttl);

    // Per-item action: mark this activity as viewed (single)
    var itemActions = document.createElement('div');
    itemActions.className = 'notif-item-actions';

    var markOneBtn = document.createElement('button');
    markOneBtn.type = 'button';
    markOneBtn.className = 'notif-iconbtn notif-iconbtn--sm notif-markone';
    markOneBtn.title = 'Переглянуто';
    markOneBtn.setAttribute('aria-label', 'Позначити як переглянуте');
    setBtnSvg(markOneBtn, svgIconMarkOne());

    markOneBtn.addEventListener('click', function (e) {
      try { if (e && e.stopPropagation) e.stopPropagation(); } catch (_) { }
      markSeen(notif).then(function (ok) {
        if (ok) removeItem(key);
      });
    });

    itemActions.appendChild(markOneBtn);
    row.appendChild(itemActions);

    var body = document.createElement('div');
    body.className = 'notif-body';
    body.textContent = messageForKind(notif, ev);

    if (kind === 'event_deleted') {
      try { body.style.color = 'var(--danger, #ff4d4d)'; } catch (_) { }
    }

        // Visible "Відкрити" link (buttons block is temporarily hidden by CSS)
    var links = null;
    if (kind !== 'event_deleted') {
      links = document.createElement('div');
      links.className = 'notif-links';

      var openLink = document.createElement('a');
      openLink.className = 'notif-link notif-openlink';
      openLink.href = '#';
      openLink.textContent = 'Відкрити';
      openLink.addEventListener('click', function (e) {
        try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch (_) { }
        openEvent(dateISO, eid);
      });

      links.appendChild(openLink);
    }

    // Optional extra line for date change
    try {
      if (kind === 'event_date_changed') {
        var p = parsePayloadMaybe(notif && notif.payload) || null;
        var b = p && p.before ? p.before : null;
        var a = p && p.after ? p.after : null;
        var bDate = b ? String(b.start_date || b._date || '') : '';
        var aDate = a ? String(a.start_date || a._date || '') : '';
        if (bDate && aDate && bDate !== aDate) {
          var extra = document.createElement('div');
          extra.className = 'notif-body-sub';
          extra.textContent = 'Було: ' + fmtDate(bDate) + ' → Стало: ' + fmtDate(aDate);
          body.appendChild(document.createElement('br'));
          body.appendChild(extra);
        }
      }
    } catch (_) { }

        var btns = document.createElement('div');
    btns.className = 'notif-buttons';

    var viewedBtn = document.createElement('button');
    viewedBtn.type = 'button';
    viewedBtn.className = 'notif-btn primary viewed';
    viewedBtn.textContent = 'Переглянуто';

    viewedBtn.addEventListener('click', function () {
      markSeen(notif).then(function (ok) {
        if (ok) removeItem(key);
      });
    });

    // Deleted events can't be opened (no "Відкрити")
    if (kind !== 'event_deleted') {
      var openBtn = document.createElement('a');
      openBtn.className = 'notif-link';
      openBtn.href = '#';
      openBtn.textContent = 'Відкрити';
      openBtn.addEventListener('click', function (e) {
        try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch (_) { }
        openEvent(dateISO, eid);
      });
      btns.appendChild(openBtn);
    }

    btns.appendChild(viewedBtn);


    item.appendChild(row);
    item.appendChild(body);
    if (links) item.appendChild(links);
    item.appendChild(btns);
    // Insert on top
    listEl.insertBefore(item, listEl.firstChild);

    byKey[key] = item;
    byEventKind[ek] = key;

    updateCount();
    if (!suppressBeep) playBeep();

    return true;
  }

  function fetchUpdates() {
    if (inFlight) return;
    inFlight = true;

    var url = '/api/notify/unseen?limit=120';
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.text().then(function (t) { return { r: r, t: t }; }); })
      .then(function (rt) {
        var r = rt.r;
        var text = rt.t;
        var payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = null; }

        if (!r.ok || !payload || payload.ok !== true) {
          if (r.status === 401) stopPolling();
          return;
        }

        var notifs = Array.isArray(payload.notifications) ? payload.notifications : [];

        // Sync: remove items that are no longer unseen on server (reviewed in another tab)
        try {
          var serverKeys = Object.create(null);
          for (var i = 0; i < notifs.length; i++) {
            var n0 = notifs[i] || {};
            var k0 = makeKey(n0);
            serverKeys[k0] = 1;

            // also keep placeholder key alive while server returns real key
            var ev0 = extractEventLike(n0);
            var eid0 = extractEventId(n0, ev0);
            var kind0 = String((n0 && n0.kind) || 'event_new');
            if (eid0) serverKeys['e:' + eid0 + ':' + kind0] = 1;
          }

          for (var k in byKey) {
            if (!Object.prototype.hasOwnProperty.call(byKey, k)) continue;

            // do not auto-remove local placeholders unless server explicitly doesn't have that event/kind for a while
            if (String(k).indexOf('e:') === 0) continue;

            if (!serverKeys[k]) removeItem(k);
          }
        } catch (_) { }

        if (!notifs.length) {
          updateCount();
          return;
        }

        // Refresh handles (in case CalendarApp loaded later)
        Data = (global.CalendarApp && global.CalendarApp.data) || Data;
        Ev = (global.CalendarApp && global.CalendarApp.events) || Ev;

        for (var j = 0; j < notifs.length; j++) {
          var n1 = notifs[j] || {};
          // add (dedup by notification key)
          addNotifyToast(n1, false);
        }
      })
      .catch(function () { /* ignore */ })
      .finally(function () { inFlight = false; });
  }

  function stopPolling() {
    if (pollTimer) {
      try { clearInterval(pollTimer); } catch (_) { }
      pollTimer = null;
    }
  }

  function startPolling() {
    stopPolling();

    ensureUI();
    updateCount();

    setTimeout(fetchUpdates, 900);
    pollTimer = setInterval(fetchUpdates, POLL_MS);
  }

  function getEventByIdInDate(dateISO, id) {
    if (!Data || typeof Data.getEventsFor !== 'function') return null;
    var arr = Data.getEventsFor(dateISO) || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && String(arr[i].id || '') === String(id || '')) return arr[i];
    }
    return null;
  }

  function onCalendarChanged(e) {
    try {
      var d = (e && e.detail) ? e.detail : {};
      if (!d || d.source !== 'submit') return;
      if (d.mode !== 'new') return;

      var dateISO = String(d.date || '');
      var id = String(d.id || '');
      if (!dateISO || !id) return;

      Data = (global.CalendarApp && global.CalendarApp.data) || Data;
      Ev = (global.CalendarApp && global.CalendarApp.events) || Ev;

      var ev = getEventByIdInDate(dateISO, id);
      if (!ev) ev = { id: id, title: 'Нова подія', type: 'other', time: '' };

      // Local placeholder notification (will be replaced by real notification.id on next poll)
      addNotifyToast({ id: null, event_id: id, kind: 'event_new', event: ev }, false);
    } catch (_) { }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
      return;
    }

    try { document.addEventListener('calendar:changed', onCalendarChanged); } catch (_) { }

    try { startPolling(); } catch (_) { }

    try { tryConsumePendingOpen(); } catch (_) { }

    // Public API (optional)
    global.CalendarApp = global.CalendarApp || {};
    global.CalendarApp.notify = global.CalendarApp.notify || {};
    global.CalendarApp.notify.pushNewEvent = function (dateISO, id) {
      try {
        dateISO = String(dateISO || '');
        id = String(id || '');
        if (!dateISO || !id) return false;

        Data = (global.CalendarApp && global.CalendarApp.data) || Data;
        Ev = (global.CalendarApp && global.CalendarApp.events) || Ev;

        var ev = getEventByIdInDate(dateISO, id) || { id: id, title: 'Нова подія', type: 'other', time: '' };
        addNotifyToast({ id: null, event_id: id, kind: 'event_new', event: ev }, false);
        return true;
      } catch (_) {
        return false;
      }
    };
  }

  init();
})(window);
