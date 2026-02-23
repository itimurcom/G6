(function (global) {
  "use strict";

  var Data = (global.CalendarApp && global.CalendarApp.data) || {};
  var Ev = (global.CalendarApp && global.CalendarApp.events) || {};
  var UI = (global.CalendarApp && global.CalendarApp.ui) || {};
  var renderAllFn = (UI && UI.renderAllFn) || function () { };

  var locale = 'uk-UA';
  var weekdayShortFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  // Multi-day helpers
  function __isoToUTCDate(iso) { var a = String(iso).split('-').map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2])); }
  function __addDaysUTC(d, n) { return new Date(d.getTime() + n * 86400000); }
  function __fmtISO(d) { var y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), da = String(d.getUTCDate()).padStart(2, '0'); return y + '-' + m + '-' + da; }
  function __hasEventOn(dateISO, id) {
    try {
      var arr = (typeof Data !== 'undefined' && Data.getEventsFor) ? (Data.getEventsFor(dateISO) || []) : [];
      for (var i = 0; i < arr.length; i++) { var e = arr[i]; if (e && e.id === id) return true; }
    } catch (_) { }
    return false;
  }
  function __findStartDateByScan(id, hintISO) {
    var cur = __isoToUTCDate(hintISO);
    for (var i = 0; i < 120; i++) {
      var prev = __addDaysUTC(cur, -1);
      var prevISO = __fmtISO(prev);
      if (!__hasEventOn(prevISO, id)) break;
      cur = prev;
    }
    return __fmtISO(cur);
  }
  function ukDayWord(n) {
    n = Math.abs(n) % 100;
    var n1 = n % 10;
    if (n > 10 && n < 20) return 'днів';
    if (n1 > 1 && n1 < 5) return 'дні';
    if (n1 == 1) return 'день';
    return 'днів';
  }

  // === Current user & permissions ===
  var __me = { id: 0, role: null, isAdmin: false };

  function getCurrentUserId() {
    var mt = document.getElementById('planning-today');
    var id = mt && mt.dataset ? parseInt(mt.dataset.userId || '0', 10) : 0;
    return isNaN(id) ? 0 : id;
  }

  (function preloadMe() {
    try { __me.id = getCurrentUserId(); } catch (_) { __me.id = 0; }
    try {
      fetch('/api/users/me')
        .then(function (r) { return r.json(); })
        .then(function (x) {
          if (x && x.ok && x.user) {
            __me.role = x.user.role || null;
            __me.isAdmin = String(__me.role || '').toLowerCase() === 'admin';
            var __id = parseInt((x.user.id || '0'), 10) || 0;
            if (__id > 0) { __me.id = __id; }
          }
        })
        .catch(function () { });
    } catch (_) { }
  })();

  function canEditEvent(ev) {
    if (!ev) return false;
    var uid = parseInt(ev.user_id || 0, 10) || 0;
    var meId = __me.id || getCurrentUserId() || 0;
    return (__me.isAdmin === true) || (uid > 0 && meId > 0 && uid === meId);
  }
  // === /permissions ===

  // Inputs
  var inputDate = $id('inputDate');
  var inputTime = $id('inputTime');
  var inputSpanDays = $id('inputSpanDays');
  var inputTitle = $id('inputTitle');

  var inputOwner = $id('inputOwner');
  var inputOwnerUserId = $id('inputOwnerUserId');
  var ownerSuggest = $id('ownerSuggest');
  var inputType = $id('inputType');
  var inputUrgent = $id('inputUrgent');
  var inputDone = $id('inputDone');

  var inputIncoming = $id('inputIncoming');
  var inputOutgoing = $id('inputOutgoing');
  var inputDescription = $id('inputDescription');

  // Info modal
  var infoOverlay = $id('infoOverlay');
  var infoModal = infoOverlay ? infoOverlay.querySelector('.modal') : null;
  var infoClose = $id('infoClose');
  var infoOk = $id('infoOk');

  // Edit modal
  var overlay = $id('eventOverlay');
  var modal = $id('eventModal');
  var editModal = overlay ? overlay.querySelector('.modal') : null;
  var btnClose = $id('btnClose');
  var btnCancel = $id('btnCancel');
  var btnDelete = $id('btnDelete');


  var __lastFocusEl = null;

  // === Owner autocomplete state ===
  var __ownerPick = null; // {id, login, name, label}
  var __ownerSuggestTimer = null;

  function __ownerParseRaw(raw) {
    try {
      if (Ev && typeof Ev.parseOwnerField === 'function') return Ev.parseOwnerField(raw);
    } catch (_) { }
    var s = (raw == null) ? '' : String(raw);
    return { type: 'text', text: s.trim(), user_id: 0, login: '', name: '', label: '' };
  }

  function __ownerSetText(text) {
    if (inputOwner) inputOwner.value = (text == null) ? '' : String(text);
    if (inputOwnerUserId) inputOwnerUserId.value = '';
    __ownerPick = null;
  }

  function __ownerSetUser(u) {
    if (!u || !u.id) { __ownerSetText((inputOwner && inputOwner.value) ? inputOwner.value : ''); return; }
    __ownerPick = {
      id: parseInt(u.id, 10) || 0,
      login: String(u.login || ''),
      name: String(u.name || ''),
      label: String(u.label || (u.name ? (u.name + (u.login ? (' (' + u.login + ')') : '')) : u.login))
    };
    if (inputOwner) inputOwner.value = __ownerPick.label;
    if (inputOwnerUserId) inputOwnerUserId.value = String(__ownerPick.id);
    __ownerHideSuggest();
  }

  function __ownerHideSuggest() {
    if (!ownerSuggest) return;
    ownerSuggest.hidden = true;
    ownerSuggest.innerHTML = '';
  }

  function __ownerRenderSuggest(list) {
    if (!ownerSuggest) return;
    ownerSuggest.innerHTML = '';
    if (!Array.isArray(list) || !list.length) {
      var empty = document.createElement('div');
      empty.className = 'owner-suggest__empty';
      empty.textContent = 'Нічого не знайдено';
      ownerSuggest.appendChild(empty);
      ownerSuggest.hidden = false;
      return;
    }

    for (var i = 0; i < list.length; i++) {
      var u = list[i] || {};
      var id = parseInt(u.id || 0, 10) || 0;
      if (!id) continue;
      var login = String(u.login || '');
      var name = String(u.name || login);
      var label = name + (login ? (' (' + login + ')') : '');

      var item = document.createElement('div');
      item.className = 'owner-suggest__item';
      item.setAttribute('role', 'button');
      item.tabIndex = 0;

      var main = document.createElement('div');
      main.className = 'owner-suggest__main';
      main.textContent = label;

      var sub = document.createElement('div');
      sub.className = 'owner-suggest__sub';
      sub.textContent = u.email ? String(u.email) : ('ID ' + id);

      item.appendChild(main);
      item.appendChild(sub);

      (function (payload) {
        item.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          __ownerSetUser(payload);
        });
        item.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); e.stopPropagation();
            __ownerSetUser(payload);
          }
        });
      })({ id: id, login: login, name: name, label: label });

      ownerSuggest.appendChild(item);
    }

    ownerSuggest.hidden = false;
  }

  function __ownerFetchSuggest(term) {
    term = (term == null) ? '' : String(term).trim();
    if (!term) { __ownerHideSuggest(); return; }
    try {
      fetch('/api/users/search?q=' + encodeURIComponent(term) + '&limit=8')
        .then(function (r) { return r.json(); })
        .then(function (x) {
          if (!x || !x.ok) { __ownerHideSuggest(); return; }
          __ownerRenderSuggest(x.users || []);
        })
        .catch(function () { __ownerHideSuggest(); });
    } catch (_) { __ownerHideSuggest(); }
  }

  function __ownerSaveValue() {
    var txt = (inputOwner && inputOwner.value) ? String(inputOwner.value).trim() : '';
    var uid = (inputOwnerUserId && inputOwnerUserId.value) ? (parseInt(inputOwnerUserId.value, 10) || 0) : 0;
    if (uid > 0 && __ownerPick && parseInt(__ownerPick.id || 0, 10) === uid) {
      // Store as JSON string in ev.owner
      return JSON.stringify({ t: 'user', id: uid, login: __ownerPick.login || '', name: __ownerPick.name || '', label: __ownerPick.label || txt });
    }
    return txt;
  }

  function __ownerInitAutocompleteOnce() {
    if (!inputOwner) return;
    if (inputOwner.dataset && inputOwner.dataset.ownerAutocomplete === '1') return;
    if (inputOwner.dataset) inputOwner.dataset.ownerAutocomplete = '1';

    inputOwner.addEventListener('input', function () {
      // If user edits manually after picking a user -> clear selection
      try {
        if (inputOwnerUserId && inputOwnerUserId.value && __ownerPick && inputOwner.value !== __ownerPick.label) {
          inputOwnerUserId.value = '';
          __ownerPick = null;
        }
      } catch (_) { }

      if (__ownerSuggestTimer) clearTimeout(__ownerSuggestTimer);
      __ownerSuggestTimer = setTimeout(function () {
        __ownerFetchSuggest(inputOwner.value);
      }, 220);
    });

    inputOwner.addEventListener('blur', function () {
      // Allow click on suggestions
      setTimeout(function () { __ownerHideSuggest(); }, 150);
    });

    inputOwner.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { __ownerHideSuggest(); }
    });
  }

  // Delete helpers (UI control lives in edit modal)
  function __removeEventEverywhereById(eventId) {
    try {
      if (!eventId) return false;
      if (!Data || typeof Data._getCache !== 'function' || typeof Data.writeStore !== 'function') return false;

      var store = Data._getCache() || {};
      var next = {};
      for (var k in store) {
        if (!Object.prototype.hasOwnProperty.call(store, k)) continue;
        var v = store[k];
        if (Array.isArray(v)) {
          next[k] = v.filter(function (e) { return !(e && e.id === eventId); });
        } else {
          next[k] = v;
        }
      }

      Data.writeStore(next);
      return true;
    } catch (_) {
      return false;
    }
  }


  if (infoClose) infoClose.addEventListener('click', function () { closeInfo(); });
  if (infoOk) infoOk.addEventListener('click', function () { closeInfo(); });

  if (inputType) inputType.addEventListener('change', function () { setEditModalType(inputType.value); });
  if (inputUrgent) inputUrgent.addEventListener('change', applyUrgentClass);
  if (inputDone) inputDone.addEventListener('change', applyDoneClass);

  if (btnClose) btnClose.addEventListener('click', function () { closeOverlay(); });
  if (btnCancel) btnCancel.addEventListener('click', function () { closeOverlay(); });


  if (btnDelete) btnDelete.addEventListener('click', function () {
    if (!overlay) return;

    var mode = String(overlay.dataset.mode || '');
    var id = String(overlay.dataset.id || '');

    // Only for existing event
    if (mode !== 'edit' || !id) return;

    var t = (inputTitle && inputTitle.value) ? String(inputTitle.value).trim() : '';
    var msg = 'Видалити подію' + (t ? (' "' + t + '"') : '') + '?';
    if (!confirm(msg)) return;

    __removeEventEverywhereById(id);

    // Refresh all blocks (calendar + planning)
    if (typeof withStableScroll === 'function') { withStableScroll(renderAllFn); } else { try { renderAllFn && renderAllFn(); } catch (_) { } }
    try { if (typeof forceRefreshUI === 'function') forceRefreshUI({ source: 'delete', id: id }); } catch (_) { }

    closeOverlay();
  });


  // Export UI API
  global.CalendarApp = global.CalendarApp || {};
  global.CalendarApp.ui = global.CalendarApp.ui || {};
  global.CalendarApp.ui.showSaving = showSaving;
  global.CalendarApp.ui.hideSaving = hideSaving;
  global.CalendarApp.ui.openModalNew = openModalNew;
  global.CalendarApp.ui.openModalEdit = openModalEdit;
  global.CalendarApp.ui.openInfo = openInfo;
  global.CalendarApp.ui.closeOverlay = closeOverlay;
  global.CalendarApp.ui.closeInfo = closeInfo;

  /* ===== Refresh glue (to keep My Tasks in sync) ===== */
  function forceRefreshUI(detail) {
    // Dispatch a DOM event other modules can listen to
    try { document.dispatchEvent(new CustomEvent('calendar:changed', { detail: detail || {} })); } catch (_) { }

    // Touch localStorage to trigger storage listeners
    try { localStorage.setItem('calendar:lastChange', String(Date.now())); } catch (_) { }

    // Call known refreshers if present
    try {
      if (typeof global.refresh === 'function') global.refresh();
      if (UI) {
        if (typeof UI.renderAllFn === 'function') UI.renderAllFn();
        if (typeof UI.renderAll === 'function') UI.renderAll();
        if (typeof UI.renderTasks === 'function') UI.renderTasks();
        if (typeof UI.refreshTasks === 'function') UI.refreshTasks();
      }
      if (global.CalendarApp && global.CalendarApp.data && typeof global.CalendarApp.data.reload === 'function') {
        global.CalendarApp.data.reload();
      }
    } catch (_) { }
  }

  /* ===== UI helpers ===== */
  function setEditModalType(t) {
    if (!editModal) return;
    editModal.classList.remove('type-mi', 'type-nas', 'type-evt', 'type-other');
    editModal.classList.add(t === 'mi' ? 'type-mi' : t === 'nas' ? 'type-nas' : t === 'evt' ? 'type-evt' : 'type-other');
  }

  function ensureSaveToast() {
    var t = $id('saveToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'saveToast';
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
      var ico = document.createElement('span'); ico.id = 'saveToastIcon'; ico.textContent = '⏳';
      var txt = document.createElement('span'); txt.id = 'saveToastText'; txt.textContent = 'Збереження…';
      t.appendChild(ico); t.appendChild(txt);
      document.body.appendChild(t);
    }
    return t;
  }

  function setToastMode(mode) {
    var t = ensureSaveToast(); var ico = $id('saveToastIcon');
    t.style.borderColor = 'var(--border)';
    t.style.boxShadow = '0 8px 20px rgba(0,0,0,.12)';
    t.style.color = 'var(--fg)';
    t.style.background = 'var(--event-bg)';
    if (mode === 'saving') {
      ico.textContent = '⏳';
    } else if (mode === 'ok') {
      t.style.background = 'var(--type-evt)'; t.style.borderColor = 'var(--type-evt)'; t.style.color = '#fff'; t.style.boxShadow = '0 8px 24px rgba(34,197,94,.28)'; ico.textContent = '✅';
      forceRefreshUI({ source: 'toast' });
    } else if (mode === 'err') {
      t.style.background = 'var(--urgent)'; t.style.borderColor = 'var(--urgent)'; t.style.color = '#fff'; t.style.boxShadow = '0 8px 24px rgba(239,68,68,.28)'; ico.textContent = '⚠️';
    }
  }
  function toastShow() { var t = ensureSaveToast(); t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; }
  function toastHide() { var t = ensureSaveToast(); t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(8px)'; }
  function showSaving(msg) { ensureSaveToast(); setToastMode('saving'); $id('saveToastText').textContent = msg || 'Збереження…'; toastShow(); }
  function hideSaving(ok) {
    ensureSaveToast();
    if (ok === true) { setToastMode('ok'); $id('saveToastText').textContent = 'Збережено'; setTimeout(toastHide, 950); }
    else if (ok === false) { setToastMode('err'); $id('saveToastText').textContent = 'Помилка збереження'; setTimeout(toastHide, 1600); }
    else { toastHide(); }
  }

  function applyUrgentClass() {
    var urgentSwitch = $id('urgentSwitch');
    if (!editModal || !urgentSwitch || !inputUrgent) return;
    editModal.classList.toggle('urgent', !!inputUrgent.checked);
    urgentSwitch.classList.toggle('active', !!inputUrgent.checked);
  }

  function applyDoneClass() {
    var doneSwitch = $id('doneSwitch');
    if (!editModal || !doneSwitch || !inputDone) return;
    doneSwitch.classList.toggle('active', !!inputDone.checked);
  }

  function showOverlay() {
    if (!overlay) return;
    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('show');
    setTimeout(function () { if (inputTitle) inputTitle.focus(); }, 0);
  }

  function closeOverlay() {
    if (!overlay) return;
    if (overlay.contains(document.activeElement)) { try { document.activeElement.blur(); } catch (_) { } }
    var x = window.scrollX, y = window.scrollY;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    requestAnimationFrame(function () {
      try { window.scrollTo(x, y); } catch (_) { }
      try { __lastFocusEl && __lastFocusEl.focus && __lastFocusEl.focus({ preventScroll: true }); } catch (_) { }
    });
  }

  function openModalNew(dateISO) {
    var modalTitle = $id('modalTitle');
    var inputEndDate = $id('inputEndDate');

    try { __lastFocusEl = document.activeElement; } catch (_) { }
    if (!overlay) return;
    if (modalTitle) modalTitle.textContent = 'Нова подія';

    overlay.dataset.mode = 'new';
    overlay.dataset.origDate = dateISO;
    overlay.dataset.id = '';

    // Delete button is only for edit mode
    if (btnDelete) { btnDelete.setAttribute('hidden', ''); btnDelete.setAttribute('aria-hidden', 'true'); btnDelete.setAttribute('tabindex', '-1'); }
    overlay.dataset.startDate = dateISO; // keep start_date on client

    if (inputDate) inputDate.value = dateISO;
    if (inputTime) inputTime.value = Ev.defaultTime();

    if (inputEndDate) inputEndDate.value = '';
    if (inputSpanDays) inputSpanDays.value = '';
    if (inputTitle) inputTitle.value = '';
    if (inputOwner) inputOwner.value = '';
    __ownerSetText('');
    if (inputType) inputType.value = 'evt';
    if (inputUrgent) inputUrgent.checked = false;
    if (inputDone) inputDone.checked = false;

    if (inputIncoming) inputIncoming.value = '';
    if (inputOutgoing) inputOutgoing.value = '';
    if (inputDescription) inputDescription.value = '';

    setEditModalType(inputType ? inputType.value : 'evt');
    applyUrgentClass();
    applyDoneClass();
    __ownerInitAutocompleteOnce();
    showOverlay();
  }

  function openModalEdit(dateISO, id) {
    var modalTitle = $id('modalTitle');
    try { __lastFocusEl = document.activeElement; } catch (_) { }
    if (!overlay) return;

    var arr = Data.getEventsFor(dateISO) || [];
    var ev = arr.find(function (e) { return e.id === id; });
    if (!ev) return;

    if (typeof canEditEvent === 'function' && !canEditEvent(ev)) { return; }

    if (inputSpanDays) {
      var ed = ev.end_date || '';
      try {
        if (ed) {
          var __a = dateISO.split('-').map(Number);
          var __b = ed.split('-').map(Number);
          var ds = new Date(Date.UTC(__a[0], __a[1] - 1, __a[2]));
          var de = new Date(Date.UTC(__b[0], __b[1] - 1, __b[2]));
          var diff = Math.round((de - ds) / 86400000) + 1;
          inputSpanDays.value = (diff > 0) ? String(diff) : '1';
        } else {
          inputSpanDays.value = '1';
        }
      } catch (_) { inputSpanDays.value = '1'; }
    }

    if (modalTitle) modalTitle.textContent = 'Редагувати подію';
    overlay.dataset.mode = 'edit';
    overlay.dataset.origDate = dateISO;
    overlay.dataset.id = id;

    // Allow delete while editing (permissions are enforced by UI + API)
    if (btnDelete) { btnDelete.removeAttribute('hidden'); btnDelete.removeAttribute('aria-hidden'); btnDelete.removeAttribute('tabindex'); }
    overlay.dataset.startDate = ev.start_date || dateISO;

    if (inputDate) inputDate.value = dateISO;
    if (inputTime) inputTime.value = ev.time || '';
    if (inputTitle) inputTitle.value = ev.title || '';
    (function setOwnerFromEvent() {
      var p = __ownerParseRaw(ev.owner);
      if (p && p.type === 'user' && (parseInt(p.user_id || 0, 10) || 0) > 0) {
        var lbl = p.label || (p.name ? (p.name + (p.login ? (' (' + p.login + ')') : '')) : p.login);
        __ownerSetUser({ id: p.user_id, login: p.login || '', name: p.name || '', label: lbl || '' });
      } else {
        __ownerSetText((p && p.text) ? p.text : (ev.owner || ''));
      }
    })();
    if (inputType) inputType.value = ev.type || 'evt';
    if (inputUrgent) inputUrgent.checked = !!ev.urgent;
    if (inputDone) inputDone.checked = !!ev.done;

    if (inputIncoming) inputIncoming.value = ev.incoming_no || '';
    if (inputOutgoing) inputOutgoing.value = ev.outgoing_no || '';
    if (inputDescription) inputDescription.value = ev.description || '';

    setEditModalType(inputType ? inputType.value : 'evt');
    applyUrgentClass();
    applyDoneClass();
    __ownerInitAutocompleteOnce();
    showOverlay();
  }

  /* ===== Інфо ===== */
  function setInfoModalType(t) {
    if (!infoModal) return;
    infoModal.classList.remove('type-mi', 'type-nas', 'type-evt', 'type-other');
    infoModal.classList.add(t === 'mi' ? 'type-mi' : t === 'nas' ? 'type-nas' : t === 'evt' ? 'type-evt' : 'type-other');
  }

  function openInfo(
    dateISO, id) {
    // Move header edit button to footer and restyle (green, text "редагувати")
    try {
      var modal = document.getElementById('infoEventModal');
      if (modal) {
        var editBtn = modal.querySelector('#editEvBtn');
        var btnBox = modal.querySelector('#infoButtons');
        if (editBtn && btnBox) {
          // Move node to footer
          if (editBtn.parentElement !== btnBox) {
            btnBox.insertBefore(editBtn, btnBox.firstChild);
          }
          // Restyle
          editBtn.className = 'btn btn--green';
          editBtn.removeAttribute('hidden');
          editBtn.removeAttribute('aria-hidden');
          editBtn.removeAttribute('title');
          editBtn.setAttribute('aria-label', 'Редагувати');
          editBtn.textContent = 'редагувати';
        }
        // Hide any leftover pencil icon buttons in header (if duplicated by server render)
        var headerPencil = modal.querySelector('header #editEvBtn');
        if (headerPencil && headerPencil !== (modal.querySelector('#infoButtons #editEvBtn'))) {
          headerPencil.style.display = 'none';
        }
      }
    } catch (e) { /* noop */ }

    

    function __renderSeenBlock(targetEl, payload, meId, eventId) {
      if (!targetEl) {
        return;
      }

      var seen = Array.isArray(payload.seen) ? payload.seen : [];
      var unseen = Array.isArray(payload.unseen) ? payload.unseen : [];

      var html = '';


      var meInSeen = false;
      try {
        var mid = parseInt(meId || 0, 10) || 0;
        if (mid > 0) {
          for (var si = 0; si < seen.length; si++) {
            var sIt = seen[si] || {};
            if (parseInt(sIt.user_id || 0, 10) === mid) { meInSeen = true; break; }
          }
        }
      } catch (_) { }

      var canMarkViewed = (!meInSeen && (parseInt(meId || 0, 10) > 0));

      html += '<div class="info-seen-head">'
            + '<strong>Переглянули:</strong>'
            + (canMarkViewed
                ? (
                  '<button type="button" id="infoMarkViewedBtn" class="notif-iconbtn notif-iconbtn--sm info-markviewed"'
                  + ' title="Переглянуто" aria-label="Позначити як переглянуте">'
                  + '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
                  + '<path d="M20 6L9 17l-5-5"></path>'
                  + '</svg>'
                  + '</button>'
                )
                : ''
              )
            + '</div>';

      if (seen.length === 0) {
        html += '<div class="muted">Поки ніхто не переглянув</div>';
      } else {
        html += '<div class="info-seen-list">';
        for (var i = 0; i < seen.length; i++) {
          var it = seen[i] || {};
          var label = Ev.escapeHtml(String(it.label || ('#' + (it.user_id || ''))));
          var t = it.seen_at ? Ev.escapeHtml(String(it.seen_at)) : '';
          html += '<span class="info-seen-chip"><span>' + label + '</span>' + (t ? ('<time>' + t + '</time>') : '') + '</span>';
        }
        html += '</div>';
      }

      if (unseen.length > 0) {
        html += '<div style="margin-top:10px;"><strong>Не переглянули:</strong></div>';
        html += '<div class="info-seen-list">';
        for (var j = 0; j < unseen.length; j++) {
          var u = unseen[j] || {};
          var ul = Ev.escapeHtml(String(u.label || ('#' + (u.user_id || ''))));
          html += '<span class="info-seen-chip"><span>' + ul + '</span></span>';
        }
        html += '</div>';
      }

      targetEl.innerHTML = html;

      // Bind click after render
      var btn = $id('infoMarkViewedBtn');
      if (btn) {
        btn.addEventListener('click', function () {
          try {
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
          } catch (_) { }

          try {
            fetch('/api/notify/viewed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ event_id: String(eventId || '') })
            })
              .then(function (r) { return r.json(); })
              .then(function () { __loadSeenByEvent(eventId); })
              .catch(function () { __loadSeenByEvent(eventId); });
          } catch (_) {
            __loadSeenByEvent(eventId);
          }
        });
      }
    }

    function __loadSeenByEvent(eventId) {
      var host = $id('infoSeenBlock');
      if (!host) return;

      host.innerHTML = '<div class="muted">Завантаження переглядів…</div>';

      try {
        fetch('/api/notify/seen-by-event?event_id=' + encodeURIComponent(String(eventId)), {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin'
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            // resolve current user id for "Переглянуто" button
            var meIdPromise = null;
            try {
              if (global.API && global.API.Users && typeof global.API.Users.me === 'function') {
                meIdPromise = global.API.Users.me()
                  .then(function (me) {
                    var id = 0;
                    try { id = parseInt((me && (me.id || me.user_id)) || 0, 10) || 0; } catch (_) { id = 0; }
                    return id;
                  })
                  .catch(function () { return 0; });
              }
            } catch (_) { meIdPromise = null; }

            if (!meIdPromise) meIdPromise = Promise.resolve(0);

            return meIdPromise.then(function (meId) {
              __renderSeenBlock(host, j, meId, eventId);
            });
          })
          .catch(function () { host.innerHTML = '<div class="muted">Перегляди: помилка завантаження</div>'; });
      } catch (_) {
        host.innerHTML = '<div class="muted">Перегляди: недоступно</div>';
      }
    }

    var infoContent = $id('infoContent');

    var arr = Data.getEventsFor(dateISO) || [];
    var ev = arr.find(function (e) { return e.id === id; });
    if (!ev) return;

    var p = dateISO.split('-').map(Number);
    var y = p[0], m = p[1], d = p[2];

    var __authorBlock = '';
    var __endBlock = '';

    try {
      var __uid = parseInt(ev.user_id || 0, 10) || 0;
      if (__uid > 0) {
        __authorBlock = '<div><strong>Автор:</strong> <span class="user--name" data-user-id="' + __uid + '"></span></div>';
      }
    } catch (_) { }

    if (ev && ev.end_date) {
      // Show end date only for multi-day events (>1 day) to avoid redundant info.
      try {
        var startISO = ev.start_date || __findStartDateByScan(id, dateISO);
        var ds = __isoToUTCDate(startISO);
        var de = __isoToUTCDate(ev.end_date);
        if (de >= ds) {
          var days = Math.round((de - ds) / 86400000) + 1;
          if (days > 1) {
            __endBlock = '<div class="info-item"><strong>Дата завершення:</strong> ' + Ev.formatISO(ev.end_date) + ' (' + days + ' ' + ukDayWord(days) + ')</div>';
          }
        } else {
          __endBlock = '<div class="info-item"><strong>Дата завершення:</strong> ' + Ev.formatISO(ev.end_date) + '</div>';
        }
      } catch (_) {
        __endBlock = '<div class="info-item"><strong>Дата завершення:</strong> ' + Ev.formatISO(ev.end_date) + '</div>';
      }
    }

    
    var __doneHtml = ev.done
      ? '<span class="info-done info-done--yes">так</span>'
      : '<span class="info-done">ні</span>';

    var __createdHtml = (ev.created_at ? Ev.escapeHtml(new Date(ev.created_at).toLocaleString(locale, { hour12: false })) : '—');

    var __weekday = weekdayShortFmt.format(new Date(Date.UTC(y, m - 1, d)));
    var __time = (ev.time && String(ev.time).trim() !== '') ? String(ev.time).trim() : '';
    var __dateTimeHtml = Ev.formatISO(dateISO) + ' (' + __weekday + ')' + (__time ? (' (' + Ev.escapeHtml(__time) + ')') : '');

    var __ownerHtml = (parseInt(ev.user_id || 0, 10) > 0)
      ? '<span class="user--name" data-user-id="' + parseInt(ev.user_id, 10) + '"></span>'
      : '—';

    var __descRaw = (typeof ev.description === 'string') ? ev.description : '';
    var __descHtml = (__descRaw && String(__descRaw).trim() !== '') ? Ev.escapeHtml(__descRaw) : '—';

    var __docsRow = '';
    if ((ev.incoming_no && String(ev.incoming_no).trim() !== '') || (ev.outgoing_no && String(ev.outgoing_no).trim() !== '')) {
      __docsRow = '' +
        '<div class="info-row info-row--docs">' +
          '<div class="info-item"><strong>Вхідний №:</strong> ' + Ev.escapeHtml(ev.incoming_no || '—') + '</div>' +
          '<div class="info-item"><strong>Вихідний №:</strong> ' + Ev.escapeHtml(ev.outgoing_no || '—') + '</div>' +
        '</div>';
    }

    var html = '' +
      '<div class="info-title">' + Ev.escapeHtml(ev.title || '') + '</div>' +

      '<div class="info-grid">' +
        // 1st row: date(+time) + responsible
        '<div class="info-row">' +
          '<div class="info-item"><strong>Дата:</strong> ' + __dateTimeHtml + '</div>' +
          '<div class="info-item"><strong>Відповідальний:</strong> ' + Ev.escapeHtml((Ev && typeof Ev.ownerDisplay === 'function') ? (Ev.ownerDisplay(ev) || '—') : (ev.owner || '—')) + '</div>' +
        '</div>' +

        // 2nd row: end date (only for multi-day)
        (__endBlock ? ('<div class="info-row info-row--full">' + __endBlock + '</div>') : '') +

        // 3rd row: created + owner (swap with type/urgent/done row)
        '<div class="info-row info-row--meta3">' +
          '<div class="info-item"><strong>Створено:</strong> ' + __createdHtml + '</div>' +
          '<div class="info-item"><strong>Власник:</strong> ' + __ownerHtml + '</div>' +
        '</div>' +

        // Type / Urgent / Done: one row, three columns, full width
        '<div class="info-row info-row--full">' +
          '<div class="info-meta3 info-meta3--full">' +
            '<div class="info-item"><strong>Тип:</strong> ' + Ev.labelForType(ev.type) + '</div>' +
            '<div class="info-item"><strong>Терміновість:</strong> ' + (ev.urgent ? 'так' : 'ні') + '</div>' +
            '<div class="info-item"><strong>Виконана:</strong> ' + __doneHtml + '</div>' +
          '</div>' +
        '</div>' +

        // Docs row (optional)
        __docsRow +

        // Description body (always shown). NOTE: the "Опис:" label is intentionally hidden (temporary).
        '<div class="info-row info-row--full">' +
          '<div class="info-desc-body container auto">' + __descHtml + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="info-seen-divider"></div>' +
      '<div id="infoSeenBlock" class="info-seen-block"><div class="muted">Завантаження переглядів…</div></div>';
if (infoContent) infoContent.innerHTML = html;
    setInfoModalType(ev.type);

    try { __loadSeenByEvent(ev.id); } catch (_) { }


    if (infoOverlay) {
      infoOverlay.classList.add('show');
      infoOverlay.setAttribute('aria-hidden', 'false');
      infoOverlay.removeAttribute('inert');

      var el = document.querySelector('#editEvBtn');
      if (el) {
        el.setAttribute('data-id', id);
        var __can = (typeof canEditEvent === 'function') ? canEditEvent(ev) : true;
        try { el.onclick = null; } catch (_) { }
        if (!__can) {
          el.hidden = true; el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1;
        } else {
          el.hidden = false; el.removeAttribute('aria-hidden'); el.tabIndex = 0;
          el.onclick = function (e) {
            closeInfo();
            e.stopPropagation();
            var eid = el.getAttribute('data-id');
            openModalEdit(el.getAttribute('data-start') || dateISO, eid);
          };
        }
      }
    }
  }

  function closeInfo() {
    if (!infoOverlay) return;
    if (infoOverlay.contains(document.activeElement)) { try { document.activeElement.blur(); } catch (_) { } }
    infoOverlay.classList.remove('show');
    infoOverlay.setAttribute('aria-hidden', 'true');
    infoOverlay.setAttribute('inert', '');
  }

  if (modal) modal.addEventListener('submit', function (e) {
    e.preventDefault();

    try {
      if (modal && typeof modal.checkValidity === 'function' && !modal.checkValidity()) {
        if (typeof modal.reportValidity === 'function') modal.reportValidity();
        return;
      }
    } catch (_) { }

    var newDate = inputDate ? inputDate.value : '';
    if (!newDate) return;

    var ev = {
      end_date: (function () {
        var v = (inputSpanDays && inputSpanDays.value !== '') ? parseInt(inputSpanDays.value, 10) : NaN;
        var d = (inputDate && inputDate.value) ? inputDate.value : '';
        if (!isNaN(v) && v > 1 && d) {
          var a = d.split('-').map(Number);
          var o = new Date(Date.UTC(a[0], a[1] - 1, a[2]));
          o.setUTCDate(o.getUTCDate() + (v - 1));
          return o.toISOString().slice(0, 10);
        }
        return null;
      })(),
      id: (overlay && overlay.dataset.id) ? overlay.dataset.id : Ev.genId(),
      time: (inputTime && inputTime.value) ? inputTime.value : '',
      title: (inputTitle && inputTitle.value) ? inputTitle.value.trim() : '',
      owner: __ownerSaveValue(),
      type: (inputType && inputType.value) ? inputType.value : 'evt',
      urgent: !!(inputUrgent && inputUrgent.checked),
      done: !!(inputDone && inputDone.checked),
      incoming_no: (inputIncoming && inputIncoming.value || '').trim(),
      outgoing_no: (inputOutgoing && inputOutgoing.value || '').trim(),
      description: (inputDescription && inputDescription.value || '').trim()
    };
    // FIX: Preserve or assign ev.user_id so "My tasks" updates immediately after save
    (function ensureUserId() {
      try {
        if (typeof ev !== 'undefined' && ev && (ev.user_id === undefined || ev.user_id === null)) {
          var existing = null;
          var od = (typeof overlay !== 'undefined' && overlay && overlay.dataset && overlay.dataset.origDate)
            ? overlay.dataset.origDate
            : (typeof newDate !== 'undefined' ? newDate : null);

          if (od && typeof Data !== 'undefined' && Data && typeof Data.getEventsFor === 'function') {
            var arr0 = Data.getEventsFor(od) || [];
            for (var i = 0; i < arr0.length; i++) {
              var x = arr0[i];
              if (x && x.id === ev.id) { existing = x; break; }
            }
          }

          if (existing && existing.user_id != null) {
            ev.user_id = existing.user_id; // Editing: keep original author
          } else {
            // Creating or unknown: try to assign current user id from STATE or DOM
            var myId = 0;
            if (typeof STATE !== 'undefined' && STATE && STATE.userId) {
              var tmp = parseInt(STATE.userId, 10);
              if (!isNaN(tmp)) myId = tmp;
            }
            if (!myId) {
              var mt = (typeof document !== 'undefined') ? document.getElementById('planning-today') : null;
              if (mt && mt.dataset && mt.dataset.userId) {
                var tmp2 = parseInt(mt.dataset.userId, 10);
                if (!isNaN(tmp2)) myId = tmp2;
              }
            }
            if (!myId) {
              try {
                if (typeof __me !== 'undefined' && __me && __me.id) {
                  var tmp3 = parseInt(__me.id, 10);
                  if (!isNaN(tmp3) && tmp3 > 0) myId = tmp3;
                }
              } catch (_e3) { }
            }
            if (myId) { ev.user_id = myId; }
          }
        }
      } catch (__e) {
        // swallow to avoid breaking save flow
      }
    })();

    // keep start_date on client: set on create, preserve on edit
    var mode = overlay ? overlay.dataset.mode : 'new';
    var origDate = overlay ? overlay.dataset.origDate : newDate;
    var startD = overlay ? (overlay.dataset.startDate || '') : '';
    if (mode === 'new') { ev.start_date = newDate; } else { ev.start_date = startD || newDate; }

    if (!ev.title) return;
    if (!ev.type) ev.type = 'evt';

    try {
      if (mode === 'edit') {
        var fromArr = Data.getEventsFor(origDate);
        var idx = Ev.findIndexById(fromArr, ev.id);
        if (idx > -1) {
          if (newDate === origDate) {
            fromArr[idx] = ev;
            Data.setEventsFor(origDate, fromArr);
          } else {
            fromArr.splice(idx, 1);
            Data.setEventsFor(origDate, fromArr);
            var toArr = Data.getEventsFor(newDate);
            toArr.push(ev);
            Data.setEventsFor(newDate, toArr);
          }
        }
      } else {
        var arrNew = Data.getEventsFor(newDate);
        arrNew.push(ev);
        Data.setEventsFor(newDate, arrNew);
      }

      // Strong refresh so "Мої задачі" та інші блоки синхронізуються
      if (typeof withStableScroll === 'function') { withStableScroll(renderAllFn); } else { try { renderAllFn && renderAllFn(); } catch (_) { } }
      forceRefreshUI({ source: 'submit', date: newDate, mode: mode, id: ev.id });

    } catch (err) {
      console.warn('submit/save failed', err);
      return;
    }

    closeOverlay();
  });

})(window);