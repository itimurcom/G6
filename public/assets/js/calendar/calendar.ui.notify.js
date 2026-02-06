/* calendar.ui.notify.js — sticky notifications (new event toast stack)
   - listens to document event: "calendar:changed" (from calendar.ui.modals.js)
   - shows a persistent toast in bottom-right on new event creation
   - optional sound (toggle)
*/

(function (global) {
  "use strict";

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

  var byId = Object.create(null); // id -> element

  var KEY_LAST = 'calendar.notify.last_seen';
  var POLL_MS = 7000; // 7s
  var pollTimer = null;
  var lastSeen = '';
  var inFlight = false;

  function parseServerNow(resp) {
    try {
      var sn = resp && resp.server_now ? String(resp.server_now) : '';
      if (sn && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(sn)) return sn;
    } catch (_) { }
    return '';
  }

  function maxCreatedAt(events, fallback) {
    var max = String(fallback || '') || '';
    if (!Array.isArray(events)) return max;
    for (var i = 0; i < events.length; i++) {
      var c = events[i] && events[i].created_at ? String(events[i].created_at) : '';
      if (c && (!max || c > max)) max = c;
    }
    return max;
  }

  function safeGetLastSeen() {
    var v = safeGet(KEY_LAST);
    return (v && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(v)) ? v : '';
  }

  function safeSetLastSeen(v) {
    if (v && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(v)) {
      safeSet(KEY_LAST, v);
    }
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

      // Sync: remove items that are no longer unseen on server (e.g., reviewed in another tab)
      try {
        var serverIds = Object.create(null);
        for (var i = 0; i < notifs.length; i++) {
          var n0 = notifs[i] || {};
          var eid0 = String(n0.event_id || (n0.event && n0.event.id) || '');
          if (eid0) serverIds[eid0] = 1;
        }
        for (var k in byId) {
          if (!Object.prototype.hasOwnProperty.call(byId, k)) continue;
          if (!serverIds[k]) removeItem(k);
        }
      } catch (_) { }

      if (!notifs.length) {
        updateCount();
        return;
      }

      // Ensure local store has these events so openInfo/edit works.
      Data = (global.CalendarApp && global.CalendarApp.data) || Data;
      Ev = (global.CalendarApp && global.CalendarApp.events) || Ev;

      // Add notifications (dedup by event.id)
      for (var j = 0; j < notifs.length; j++) {
        var n1 = notifs[j] || {};
        var ev1 = (n1 && n1.event) ? n1.event : null;

        var dateISO = '';
        var eventId = '';
        if (ev1) {
          dateISO = String(ev1.start_date || ev1._date || '');
          eventId = String(ev1.id || n1.event_id || '');
        } else {
          eventId = String(n1.event_id || '');
        }

        if (!eventId) continue;

        // If no event payload, still show minimal notification
        if (!ev1) {
          ev1 = { id: eventId, title: 'Нова подія', type: 'other', time: '' };
        }
        if (!dateISO) dateISO = String(ev1.start_date || ev1._date || '');

        addNewEventToast(dateISO, ev1);
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

  // Ensure UI exists (will be hidden if empty)
  ensureUI();
  updateCount();

  // first check soon
  setTimeout(fetchUpdates, 900);
  pollTimer = setInterval(fetchUpdates, POLL_MS);
}

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { }
  }

function markSeen(eventId) {
  var eid = String(eventId || '');
  if (!eid) return Promise.resolve(false);

  return fetch('/api/notify/seen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eid, kind: 'event_new' })
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

  function getEventByIdInDate(dateISO, id) {
    if (!Data || typeof Data.getEventsFor !== 'function') return null;
    var arr = Data.getEventsFor(dateISO) || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && String(arr[i].id || '') === String(id || '')) return arr[i];
    }
    return null;
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
    btnCollapse.textContent = collapsed ? '▴' : '▾';

    btnSound = document.createElement('button');
    btnSound.type = 'button';
    btnSound.className = 'notif-iconbtn';
    btnSound.title = soundEnabled ? 'Звук: увімкнено' : 'Звук: вимкнено';
    btnSound.setAttribute('aria-label', btnSound.title);
    btnSound.textContent = soundEnabled ? 'звук' : 'без звуку';

    btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'notif-iconbtn';
    btnClear.title = 'Переглянуто всі';
    btnClear.setAttribute('aria-label', 'Позначити всі повідомлення як переглянуті');
    btnClear.textContent = 'переглянуто всі';

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
      btnSound.textContent = soundEnabled ? 'звук' : 'без звуку';

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
          for (var k in byId) { if (Object.prototype.hasOwnProperty.call(byId, k)) delete byId[k]; }
        } catch (_) { }
        updateCount();
        // Sync with server (in case some items were already reviewed elsewhere)
        try { setTimeout(fetchUpdates, 300); } catch (_) { }
      });
    });

    btnCollapse.addEventListener('click', function () {
      var isCollapsed = (listEl.style.display === 'none');
      if (isCollapsed) {
        listEl.style.display = '';
        btnCollapse.textContent = '▾';
        btnCollapse.title = 'Згорнути';
        safeSet(KEY_COLLAPSED, '0');
      } else {
        listEl.style.display = 'none';
        btnCollapse.textContent = '▴';
        btnCollapse.title = 'Розгорнути';
        safeSet(KEY_COLLAPSED, '1');
      }
      btnCollapse.setAttribute('aria-label', btnCollapse.title);
    });

    updateCount();
  }

  function bumpExisting(id) {
    var el = byId[String(id || '')];
    if (!el) return;

    // move to top
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

  function removeItem(id) {
    var key = String(id || '');
    var el = byId[key];
    if (!el) return;
    try { if (el.parentNode) el.parentNode.removeChild(el); } catch (_) { }
    try { delete byId[key]; } catch (_) { }
    updateCount();
  }

  function addNewEventToast(dateISO, ev) {
    ensureUI();
    if (!listEl) return;

    var id = String((ev && ev.id) || '');
    if (!id) return;

    if (byId[id]) {
      bumpExisting(id);
      updateCount();
      return;
    }

    var type = String((ev && ev.type) || 'other');

    var item = document.createElement('div');
    item.className = 'notif-item';
    item.dataset.id = id;
    item.dataset.date = String(dateISO || '');
    item.dataset.type = type;

    var row = document.createElement('div');
    row.className = 'notif-row';

    var ttl = document.createElement('div');
    ttl.className = 'notif-item-title';

    var titleText = document.createElement('div');
    titleText.textContent = (ev && ev.title) ? String(ev.title) : 'Нова подія';

    var subtitle = document.createElement('small');
    var when = [];
    if (dateISO) when.push(fmtDate(dateISO));
    if (ev && ev.time) when.push(String(ev.time));
    if (type) when.push(labelForType(type));
    subtitle.textContent = when.join(' • ');

    ttl.appendChild(titleText);
    ttl.appendChild(subtitle);
    row.appendChild(ttl);

    var body = document.createElement('div');
    body.className = 'notif-body';
    body.textContent = 'Додано нову подію.';

    var meta = document.createElement('div');
    meta.className = 'notif-meta';
    if (ev && ev.owner) {
      var m1 = document.createElement('span');
      m1.textContent = 'Відповідальний: ' + String(ev.owner);
      meta.appendChild(m1);
    }

    var btns = document.createElement('div');
    btns.className = 'notif-buttons';
    var openBtn = document.createElement('a');
    openBtn.className = 'notif-link';
    openBtn.href = '#';
    openBtn.textContent = 'Відкрити';

    var viewedBtn = document.createElement('button');
    viewedBtn.type = 'button';
    viewedBtn.className = 'notif-btn primary viewed';
    viewedBtn.textContent = 'Переглянуто';

    btns.appendChild(openBtn);
    btns.appendChild(viewedBtn);

    item.appendChild(row);
    item.appendChild(body);
    if (meta.children.length) item.appendChild(meta);
    item.appendChild(btns);    openBtn.addEventListener('click', function (e) {
      try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch (_) { }
      try {
        if (global.CalendarApp && global.CalendarApp.ui && typeof global.CalendarApp.ui.openInfo === 'function') {
          global.CalendarApp.ui.openInfo(String(dateISO || ''), id);
        }
      } catch (_) { }
    });

    viewedBtn.addEventListener('click', function () {
      markSeen(id).finally(function(){
        removeItem(id);
      });
    });

    // Insert on top
    listEl.insertBefore(item, listEl.firstChild);
    byId[id] = item;

    updateCount();
    playBeep();
  }

  function onCalendarChanged(e) {
    try {
      var d = (e && e.detail) ? e.detail : {};
      if (!d || d.source !== 'submit') return;
      if (d.mode !== 'new') return;

      var dateISO = String(d.date || '');
      var id = String(d.id || '');
      if (!dateISO || !id) return;

      var ev = getEventByIdInDate(dateISO, id);
      if (!ev) {
        // fallback minimal payload
        ev = { id: id, title: 'Нова подія', type: 'other', time: '' };
      }

      addNewEventToast(dateISO, ev);
    } catch (_) { }
  }

  function init() {
    // Defer to ensure body exists
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
      return;
    }

    // If CalendarApp isn't ready yet, still attach listener; we resolve Data lazily.
    try { document.addEventListener('calendar:changed', onCalendarChanged); } catch (_) { }

    // Poll server for new events created by other users/browsers
    try { startPolling(); } catch (_) { }

    // Public API (optional)
    global.CalendarApp = global.CalendarApp || {};
    global.CalendarApp.notify = global.CalendarApp.notify || {};
    global.CalendarApp.notify.pushNewEvent = function (dateISO, id) {
      try {
        dateISO = String(dateISO || '');
        id = String(id || '');
        if (!dateISO || !id) return false;
        // refresh handles
        Data = (global.CalendarApp && global.CalendarApp.data) || Data;
        Ev = (global.CalendarApp && global.CalendarApp.events) || Ev;
        var ev = getEventByIdInDate(dateISO, id) || { id: id, title: 'Нова подія', type: 'other', time: '' };
        addNewEventToast(dateISO, ev);
        return true;
      } catch (_) {
        return false;
      }
    };
  }

  init();
})(window);
