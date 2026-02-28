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
            var __rl = String(__me.role || '').toLowerCase();
            __me.isAdmin = (__rl === 'admin' || __rl === 'superadmin' || __rl === 'root' || !!x.user.is_admin);
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

  function __isMyEventForInfo(ev) {
    if (!ev) return false;
    var meId = (__me && __me.id) || getCurrentUserId() || 0;
    if (!meId) return false;
    var uid = parseInt((ev && ev.user_id) || 0, 10) || 0;
    return (uid > 0 && uid === meId);
  }

  function __ownerUserIdForInfo(ev) {
    try {
      if (Ev && typeof Ev.ownerUserId === 'function') {
        return parseInt(Ev.ownerUserId(ev) || 0, 10) || 0;
      }
    } catch (_) { }
    try {
      if (Ev && typeof Ev.parseOwnerField === 'function') {
        var p = Ev.parseOwnerField(ev && ev.owner);
        return (p && p.type === 'user') ? (parseInt(p.user_id || 0, 10) || 0) : 0;
      }
    } catch (_) { }
    return 0;
  }

  function __isAssignedToMeForInfo(ev) {
    if (!ev || ev.done) return false;
    var meId = (__me && __me.id) || getCurrentUserId() || 0;
    if (!meId) return false;
    var ownerId = __ownerUserIdForInfo(ev);
    return (ownerId > 0 && ownerId === meId);
  }

  function __isOverdueForInfo(ev, fallbackDateISO) {
    try {
      if (UI && typeof UI.isEventOverdueStrict === 'function') return !!UI.isEventOverdueStrict(ev);
    } catch (_) { }

    try {
      if (!ev || !!ev.done) return false;
      var iso = String((ev && (ev.date || ev.start_date || ev.end_date)) || (fallbackDateISO || '')).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;

      var now = new Date();
      var todayISO = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      if (iso < todayISO) return true;
      if (iso > todayISO) return false;

      var tm = String((ev && ev.time) || '').trim();
      var m = /^(\d{1,2}):(\d{2})$/.exec(tm);
      if (!m) return false;

      var hh = Math.max(0, Math.min(23, parseInt(m[1], 10) || 0));
      var mm = Math.max(0, Math.min(59, parseInt(m[2], 10) || 0));
      var evHM = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      var nowHM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      return evHM < nowHM;
    } catch (_) { }

    return false;
  }

  function __infoStatusBadgesHtml(ev, fallbackDateISO, variant) {
    var showAssigned = __isAssignedToMeForInfo(ev);
    var showMy = (!showAssigned && __isMyEventForInfo(ev));
    var showOverdue = __isOverdueForInfo(ev, fallbackDateISO);
    if (!showAssigned && !showMy && !showOverdue) return '';

    var wrapClass = (variant === 'header') ? 'info-badges info-badges--header' : 'info-badges';
    var parts = [];
    if (showOverdue) {
      parts.push(''
        + '<span class="info-badge info-badge--overdue ev--overdue-flash" title="Подія прострочена">'
        +   '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
        +     '<path d="M12 2.5c5.25 0 9.5 4.25 9.5 9.5s-4.25 9.5-9.5 9.5S2.5 17.25 2.5 12 6.75 2.5 12 2.5Z" fill="currentColor" opacity=".16"></path>'
        +     '<path d="M12 6.25v6.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>'
        +     '<circle cx="12" cy="16.9" r="1.1" fill="currentColor"></circle>'
        +     '<path d="M12 2.75a9.25 9.25 0 1 1 0 18.5a9.25 9.25 0 0 1 0-18.5Z" fill="none" stroke="currentColor" stroke-width="1.7"></path>'
        +   '</svg>'
        +   '<span>Подія прострочена</span>'
        + '</span>');
    }
    if (showAssigned) {
      parts.push(''
        + '<span class="info-badge info-badge--assigned" title="На виконанні у мене">'
        +   '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
        +     '<path d="M15.5 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="currentColor" opacity=".95"></path>'
        +     '<path d="M9.5 20.5c.5-2.8 2.8-4.8 5.9-4.8 3 0 5.2 1.8 5.8 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>'
        +     '<path d="M3.5 12.5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>'
        +     '<path d="M6.5 9.5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>'
        +   '</svg>'
        +   '<span>На виконанні</span>'
        + '</span>');
    }
    if (showMy) {
      parts.push(''
        + '<span class="info-badge info-badge--my" title="Подія створена мною">'
        +   '<svg aria-hidden="true" focusable="false"><use href="#i-user"></use></svg>'
        +   '<span>Моя подія</span>'
        + '</span>');
    }

    return '<div class="' + wrapClass + '">' + parts.join('') + '</div>';
  }

  function __setInfoHeaderBadges(ev, fallbackDateISO) {
    var host = document.getElementById('infoHeaderBadges');
    if (!host) return;
    var html = __infoStatusBadgesHtml(ev, fallbackDateISO, 'header');
    host.innerHTML = html || '';
    host.hidden = !html;
  }
  // === Event thread in info modal ===
  function __threadEsc(value) {
    return Ev.escapeHtml(String(value == null ? '' : value));
  }

  function __threadInitials(value) {
    var src = String(value || '').trim();
    if (!src) return '??';
    var parts = src.split(/\s+/).filter(Boolean);
    if (!parts.length) return '??';
    var first = Array.from(parts[0])[0] || '';
    var second = parts.length > 1 ? (Array.from(parts[1])[0] || '') : (Array.from(parts[0])[1] || '');
    return (first + second).toUpperCase() || '??';
  }

  function __threadFormatDateTime(value) {
    var src = String(value || '').trim();
    if (!src) return '—';
    var normalized = src.replace(' ', 'T');
    var dt = new Date(normalized);
    if (isNaN(dt.getTime())) return src;
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(dt);
    } catch (_) {
      return src;
    }
  }

  function __threadCurrentUser() {
    var ds = (infoOverlay && infoOverlay.dataset) ? infoOverlay.dataset : {};
    var id = parseInt(ds.currentUserId || ((__me && __me.id) || 0), 10) || 0;
    var display = String(ds.currentUserDisplay || '').trim();
    if (!display) display = id > 0 ? ('User #' + id) : 'Користувач';
    var isAdmin = String(ds.currentUserIsAdmin || '') === '1' || !!(__me && __me.isAdmin);
    var avatarUrl = String(ds.currentUserAvatarUrl || '').trim();
    var hasAvatar = String(ds.currentUserHasAvatar || '') === '1' || !!avatarUrl;
    return { id: id, display: display, isAdmin: isAdmin, hasAvatar: hasAvatar, avatarUrl: avatarUrl };
  }

  function __threadGetState() {
    if (!infoOverlay) return null;
    if (!infoOverlay.__threadState) {
      infoOverlay.__threadState = {
        eventId: '',
        loaded: false,
        loading: false,
        saving: false,
        composerOpen: false,
        countLoading: false,
        countValue: null,
        items: [],
        editingId: 0,
        editingText: ''
      };
    }
    return infoOverlay.__threadState;
  }

  function __threadReset(eventId) {
    if (!infoOverlay) return;
    infoOverlay.__threadState = {
      eventId: String(eventId || ''),
      loaded: false,
      loading: false,
      saving: false,
      composerOpen: false,
      countLoading: false,
      countValue: null,
      items: [],
      editingId: 0,
      editingText: ''
    };
  }

  function __threadSetCount(n) {
    var el = document.getElementById('infoThreadCount');
    if (!el) return;
    if (n == null || n === '') {
      el.textContent = '';
      return;
    }
    el.textContent = '(' + String(n) + ')';
  }

  function __threadSetStatus(message, type) {
    var el = document.getElementById('infoThreadStatus');
    if (!el) return;
    var text = String(message || '').trim();
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.classList.remove('is-error', 'is-success');
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-success', type === 'success');
  }

  function __threadSetComposerVisible(openIt) {
    var state = __threadGetState();
    if (!state) return;
    state.composerOpen = !!openIt;
    var box = document.getElementById('infoThreadComposer');
    var toggleBtn = document.getElementById('infoThreadComposerToggle');
    if (box) box.hidden = !state.composerOpen;
    if (toggleBtn) toggleBtn.hidden = state.composerOpen;
    if (state.composerOpen) {
      var input = document.getElementById('infoThreadInput');
      if (input) {
        setTimeout(function () { try { input.focus(); } catch (_) { } }, 0);
      }
    }
  }

  function __threadAvatarHtml(author, fallbackDisplay) {
    var a = author && typeof author === 'object' ? author : {};
    var url = String(a.avatar_url || a.avatarUrl || '').trim();
    var display = String(a.display || fallbackDisplay || '').trim();
    if (url) {
      return '<img src="' + __threadEsc(url) + '" alt="' + __threadEsc(display) + '">';
    }
    return '<span>' + __threadEsc(__threadInitials(display)) + '</span>';
  }

  function __threadSyncComposerIdentity() {
    var me = __threadCurrentUser();
    var avatar = document.getElementById('infoThreadComposerAvatar');
    var author = document.getElementById('infoThreadComposerAuthor');
    if (avatar) {
      avatar.classList.toggle('has-image', !!(me.hasAvatar && me.avatarUrl));
      avatar.innerHTML = __threadAvatarHtml({ avatar_url: me.avatarUrl, display: me.display }, me.display);
    }
    if (author) author.textContent = me.display;
  }

  function __threadCanManage(item) {
    var me = __threadCurrentUser();
    var authorId = parseInt((item && item.user_id) || 0, 10) || 0;
    return !!(me.isAdmin || (me.id > 0 && authorId === me.id));
  }

  function __threadRenderEmpty() {
    return ''
      + '<div class="info-thread-empty">'
      +   '<div class="info-thread-empty__title">Поки немає коментарів</div>'
      +   '<div class="info-thread-empty__text">Почни переписку по задачі з першого коментаря. Коментарі завантажуються лише коли ти відкриваєш цей блок.</div>'
      + '</div>';
  }

  function __threadRenderItem(item, state) {
    state = state || __threadGetState();
    var author = item && item.author ? item.author : {};
    var display = String(author.display || author.name || author.login || ('User #' + (item.user_id || 0)));
    var avatar = __threadAvatarHtml(author, display);
    var avatarClass = 'info-thread-message__avatar' + ((author && author.avatar_url) ? ' has-image' : '');
    var itemId = parseInt(item.id || 0, 10) || 0;
    var edited = !!item.edited_at;
    var canManage = __threadCanManage(item);
    var isEditing = state && state.editingId === itemId;

    var actions = '';
    if (canManage) {
      actions += '<div class="info-thread-message__actions">';
      if (!isEditing) {
        actions += '<button type="button" class="info-thread-action" data-thread-action="edit" data-id="' + itemId + '">Редагувати</button>';
        actions += '<button type="button" class="info-thread-action info-thread-action--danger" data-thread-action="delete" data-id="' + itemId + '">Видалити</button>';
      }
      actions += '</div>';
    }

    var body = '';
    if (isEditing) {
      body += '<div class="info-thread-editor">';
      body += '<textarea class="input info-thread-textarea info-thread-editor__textarea" rows="3" maxlength="20000" data-thread-role="edit-input" data-id="' + itemId + '" placeholder="Відредагуйте коментар…">' + __threadEsc(state.editingText) + '</textarea>';
      body += '<div class="info-thread-editor__actions">';
      body += '<button type="button" class="btn btn--green" data-thread-action="save-edit" data-id="' + itemId + '">Зберегти</button>';
      body += '<button type="button" class="btn" data-thread-action="cancel-edit" data-id="' + itemId + '">Скасувати</button>';
      body += '</div></div>';
    } else {
      body += '<div class="info-thread-message__text">' + __threadEsc(item.message_text || '') + '</div>';
    }

    return ''
      + '<article class="info-thread-message" data-message-id="' + itemId + '">' 
      +   '<div class="' + avatarClass + '">' + avatar + '</div>'
      +   '<div class="info-thread-message__body">'
      +     '<div class="info-thread-message__meta">'
      +       '<span class="info-thread-message__author">' + __threadEsc(display) + '</span>'
      +       '<time class="info-thread-message__time" datetime="' + __threadEsc(item.created_at || '') + '">' + __threadEsc(__threadFormatDateTime(item.created_at)) + '</time>'
      +       (edited ? '<span class="info-thread-message__edited">відредаговано</span>' : '')
      +       actions
      +     '</div>'
      +     body
      +   '</div>'
      + '</article>';
  }

  function __threadRender() {
    var state = __threadGetState();
    var host = document.getElementById('infoThreadList');
    if (!state || !host) return;
    __threadSetCount(state.countValue == null ? state.items.length : state.countValue);
    if (!state.items.length) {
      host.innerHTML = __threadRenderEmpty();
    } else {
      host.innerHTML = state.items.map(function (item) { return __threadRenderItem(item, state); }).join('');
    }
    __threadSetComposerVisible(state.composerOpen);
    if (state.editingId > 0) {
      var input = host.querySelector('[data-thread-role="edit-input"][data-id="' + state.editingId + '"]');
      if (input) {
        try { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } catch (_) { }
      }
    }
  }

  function __threadFetchJson(url, init) {
    return fetch(url, Object.assign({ credentials: 'same-origin' }, init || {}))
      .then(function (response) {
        return response.json().catch(function () { return null; }).then(function (data) {
          if (!response.ok || !data || data.ok === false) {
            var msg = data && (data.message || data.error) ? (data.message || data.error) : ('HTTP ' + response.status);
            throw new Error(String(msg));
          }
          return data;
        });
      });
  }

  function __threadLoad(eventId) {
    var state = __threadGetState();
    var host = document.getElementById('infoThreadList');
    if (!state || !host) return;
    if (state.loading) return;
    state.loading = true;
    host.innerHTML = '<div class="info-thread-loading">Завантаження коментарів…</div>';
    __threadSetStatus('', '');
    __threadFetchJson('/api/event-messages/list?event_id=' + encodeURIComponent(String(eventId || '')))
      .then(function (data) {
        state.items = Array.isArray(data.items) ? data.items : [];
        state.countValue = (data && data.total != null) ? (parseInt(data.total, 10) || 0) : state.items.length;
        state.loaded = true;
        __threadRender();
      })
      .catch(function (error) {
        state.items = [];
        state.loaded = false;
        state.countValue = null;
        host.innerHTML = __threadRenderEmpty();
        __threadSetStatus('Не вдалося завантажити коментарі: ' + error.message, 'error');
      })
      .finally(function () {
        state.loading = false;
      });
  }

  function __threadPrefetchCount(eventId) {
    var state = __threadGetState();
    if (!state) return;
    if (state.countLoading) return;
    if (state.countValue != null && String(state.eventId || '') === String(eventId || '')) return;
    state.countLoading = true;
    __threadFetchJson('/api/event-messages/list?event_id=' + encodeURIComponent(String(eventId || '')) + '&limit=1')
      .then(function (data) {
        state.countValue = (data && data.total != null) ? (parseInt(data.total, 10) || 0) : (Array.isArray(data.items) ? data.items.length : 0);
        __threadSetCount(state.countValue);
      })
      .catch(function () {
        state.countValue = null;
        __threadSetCount('');
      })
      .finally(function () {
        state.countLoading = false;
      });
  }

  function __threadCreate() {
    var state = __threadGetState();
    var input = document.getElementById('infoThreadInput');
    if (!state || !input || state.saving) return;
    var messageText = String(input.value || '').replace(/\r\n?/g, '\n').trim();
    if (!messageText) {
      __threadSetStatus('Введи текст коментаря.', 'error');
      try { input.focus(); } catch (_) { }
      return;
    }
    state.saving = true;
    __threadSetStatus('Збереження коментаря…', '');
    __threadFetchJson('/api/event-messages/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: state.eventId, message_text: messageText })
    })
      .then(function (data) {
        var row = data && data.message ? data.message : null;
        if (!row) throw new Error('Порожня відповідь сервера');
        state.items = state.items.concat([row]);
        input.value = '';
        state.composerOpen = false;
        __threadRender();
        __threadSetStatus('Коментар додано.', 'success');
        setTimeout(function () { __threadSetStatus('', ''); }, 1800);
      })
      .catch(function (error) {
        __threadSetStatus('Не вдалося додати коментар: ' + error.message, 'error');
      })
      .finally(function () {
        state.saving = false;
      });
  }

  function __threadStartEdit(id) {
    var state = __threadGetState();
    if (!state) return;
    for (var i = 0; i < state.items.length; i++) {
      var item = state.items[i];
      if ((parseInt(item.id || 0, 10) || 0) === id && __threadCanManage(item)) {
        state.editingId = id;
        state.editingText = String(item.message_text || '');
        __threadRender();
        return;
      }
    }
  }

  function __threadCancelEdit() {
    var state = __threadGetState();
    if (!state) return;
    state.editingId = 0;
    state.editingText = '';
    __threadRender();
  }

  function __threadSaveEdit(id) {
    var state = __threadGetState();
    var host = document.getElementById('infoThreadList');
    if (!state || !host || state.saving) return;
    var input = host.querySelector('[data-thread-role="edit-input"][data-id="' + id + '"]');
    var messageText = String(input ? input.value : state.editingText).replace(/\r\n?/g, '\n').trim();
    if (!messageText) {
      __threadSetStatus('Текст коментаря не може бути порожнім.', 'error');
      if (input) { try { input.focus(); } catch (_) { } }
      return;
    }
    state.saving = true;
    __threadSetStatus('Збереження змін…', '');
    __threadFetchJson('/api/event-messages/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, message_text: messageText })
    })
      .then(function (data) {
        var row = data && data.message ? data.message : null;
        if (!row) throw new Error('Порожня відповідь сервера');
        state.items = state.items.map(function (item) {
          return (parseInt(item.id || 0, 10) || 0) === id ? row : item;
        });
        state.editingId = 0;
        state.editingText = '';
        __threadRender();
        __threadSetStatus('Коментар відредаговано.', 'success');
        setTimeout(function () { __threadSetStatus('', ''); }, 1800);
      })
      .catch(function (error) {
        __threadSetStatus('Не вдалося відредагувати коментар: ' + error.message, 'error');
      })
      .finally(function () {
        state.saving = false;
      });
  }

  function __threadDelete(id) {
    var state = __threadGetState();
    if (!state || state.saving) return;
    var target = null;
    for (var i = 0; i < state.items.length; i++) {
      var item = state.items[i];
      if ((parseInt(item.id || 0, 10) || 0) === id) { target = item; break; }
    }
    if (!target || !__threadCanManage(target)) return;
    if (!window.confirm('Видалити цей коментар?')) return;
    state.saving = true;
    __threadSetStatus('Видалення коментаря…', '');
    __threadFetchJson('/api/event-messages/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    })
      .then(function () {
        state.items = state.items.filter(function (item) {
          return (parseInt(item.id || 0, 10) || 0) !== id;
        });
        if (state.editingId === id) {
          state.editingId = 0;
          state.editingText = '';
        }
        __threadRender();
        __threadSetStatus('Коментар видалено.', 'success');
        setTimeout(function () { __threadSetStatus('', ''); }, 1800);
      })
      .catch(function (error) {
        __threadSetStatus('Не вдалося видалити коментар: ' + error.message, 'error');
      })
      .finally(function () {
        state.saving = false;
      });
  }

  function __infoThreadHtml() {
    var me = __threadCurrentUser();
    return ''
      + '<details class="info-thread-wrap" id="infoThreadWrap">'
      +   '<summary class="info-thread-head"><strong>Коментарі <span id="infoThreadCount" class="info-thread-count"></span></strong></summary>'
      +   '<div class="info-thread-body">'
      +     '<div id="infoThreadStatus" class="info-thread-status" hidden></div>'
      +     '<div class="info-thread-toolbar">'
      +       '<button type="button" id="infoThreadComposerToggle" class="btn">Написати коментар</button>'
      +     '</div>'
      +     '<div id="infoThreadComposer" class="info-thread-composer" hidden>'
      +       '<div id="infoThreadComposerAvatar" class="info-thread-composer__avatar' + ((me.hasAvatar && me.avatarUrl) ? ' has-image' : '') + '">' + __threadAvatarHtml({ avatar_url: me.avatarUrl, display: me.display }, me.display) + '</div>'
      +       '<div class="info-thread-composer__main">'
      +         '<div id="infoThreadComposerAuthor" class="info-thread-composer__author">' + __threadEsc(me.display) + '</div>'
      +         '<div class="info-thread-composer__row">'
      +           '<textarea id="infoThreadInput" class="input info-thread-textarea" rows="3" maxlength="20000" placeholder="Напишіть коментар по задачі…"></textarea>'
      +           '<div class="info-thread-composer__actions">'
      +             '<button type="button" id="infoThreadSendBtn" class="btn btn--green">Надіслати</button>'
      +             '<button type="button" id="infoThreadComposerCancel" class="btn">Скасувати</button>'
      +           '</div>'
      +         '</div>'
      +       '</div>'
      +     '</div>'
      +     '<div id="infoThreadList" class="info-thread-list">'
      +       '<div class="info-thread-hint">Відкрий цей блок — і коментарі завантажаться тільки в момент потреби.</div>'
      +     '</div>'
      +   '</div>'
      + '</details>';
  }

  function __bindInfoThread(eventId) {
    var wrap = document.getElementById('infoThreadWrap');
    if (!wrap || wrap.__threadBound) return;
    wrap.__threadBound = true;

    var state = __threadGetState();
    if (state) state.eventId = String(eventId || '');

    wrap.addEventListener('toggle', function () {
      var st = __threadGetState();
      if (!st) return;
      if (wrap.open && !st.loaded && !st.loading) {
        __threadLoad(eventId);
      }
    });

    var composerToggle = document.getElementById('infoThreadComposerToggle');
    if (composerToggle) {
      composerToggle.addEventListener('click', function () {
        __threadSetComposerVisible(true);
      });
    }

    var composerCancel = document.getElementById('infoThreadComposerCancel');
    if (composerCancel) {
      composerCancel.addEventListener('click', function () {
        __threadSetComposerVisible(false);
        __threadSetStatus('', '');
      });
    }

    var sendBtn = document.getElementById('infoThreadSendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        __threadCreate();
      });
    }

    var input = document.getElementById('infoThreadInput');
    if (input) {
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          ev.preventDefault();
          __threadCreate();
        }
      });
    }

    var list = document.getElementById('infoThreadList');
    if (list) {
      list.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-thread-action]');
        if (!btn) return;
        var action = String(btn.getAttribute('data-thread-action') || '');
        var id = parseInt(btn.getAttribute('data-id') || '0', 10) || 0;
        if (id <= 0) return;
        if (action === 'edit') __threadStartEdit(id);
        else if (action === 'cancel-edit') __threadCancelEdit();
        else if (action === 'save-edit') __threadSaveEdit(id);
        else if (action === 'delete') __threadDelete(id);
      });

      list.addEventListener('input', function (ev) {
        var inputEl = ev.target.closest('[data-thread-role="edit-input"]');
        if (!inputEl) return;
        var st = __threadGetState();
        if (!st) return;
        var id = parseInt(inputEl.getAttribute('data-id') || '0', 10) || 0;
        if (id > 0 && st.editingId === id) {
          st.editingText = String(inputEl.value || '');
        }
      });

      list.addEventListener('keydown', function (ev) {
        var inputEl = ev.target.closest('[data-thread-role="edit-input"]');
        if (!inputEl) return;
        if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
          ev.preventDefault();
          var id = parseInt(inputEl.getAttribute('data-id') || '0', 10) || 0;
          if (id > 0) __threadSaveEdit(id);
        }
      });
    }

    __threadSyncComposerIdentity();
    __threadSetCount('');
    __threadSetStatus('', '');
    __threadSetComposerVisible(false);
    __threadPrefetchCount(eventId);
  }
  // === /Event thread in info modal ===

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

  function __ownerSetTextChoice(text) {
    __ownerSetText(text);
    __ownerHideSuggest();
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
      var row = list[i] || {};
      var kind = String(row.kind || row.type || (row.id ? 'user' : 'text')).toLowerCase();

      if (kind === 'user') {
        var id = parseInt(row.id || 0, 10) || 0;
        if (!id) continue;
        var login = String(row.login || '');
        var name = String(row.name || login);
        var label = String(row.label || (name + (login ? (' (' + login + ')') : '')));

        var item = document.createElement('div');
        item.className = 'owner-suggest__item';
        item.setAttribute('role', 'button');
        item.tabIndex = 0;

        var main = document.createElement('div');
        main.className = 'owner-suggest__main';
        main.textContent = label;

        var sub = document.createElement('div');
        sub.className = 'owner-suggest__sub';
        sub.textContent = row.email ? String(row.email) : ('Користувач · ID ' + id);

        item.appendChild(main);
        item.appendChild(sub);

        (function (payload, el) {
          el.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            __ownerSetUser(payload);
          });
          el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); e.stopPropagation();
              __ownerSetUser(payload);
            }
          });
        })({ id: id, login: login, name: name, label: label }, item);

        ownerSuggest.appendChild(item);
        continue;
      }

      var txt = String(row.text || row.label || '').trim();
      if (!txt) continue;

      var titem = document.createElement('div');
      titem.className = 'owner-suggest__item';
      titem.setAttribute('role', 'button');
      titem.tabIndex = 0;

      var tmain = document.createElement('div');
      tmain.className = 'owner-suggest__main';
      tmain.textContent = txt;

      var tsub = document.createElement('div');
      tsub.className = 'owner-suggest__sub';
      tsub.textContent = 'Текст з попередніх подій';

      titem.appendChild(tmain);
      titem.appendChild(tsub);

      (function (payloadText, el) {
        el.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          __ownerSetTextChoice(payloadText);
        });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); e.stopPropagation();
            __ownerSetTextChoice(payloadText);
          }
        });
      })(txt, titem);

      ownerSuggest.appendChild(titem);
    }

    if (!ownerSuggest.children.length) {
      var empty2 = document.createElement('div');
      empty2.className = 'owner-suggest__empty';
      empty2.textContent = 'Нічого не знайдено';
      ownerSuggest.appendChild(empty2);
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
          __ownerRenderSuggest(x.items || x.users || []);
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
    try { if (infoOverlay && infoOverlay.dataset) { infoOverlay.dataset.pdfEventId = String(id || ''); } } catch (_) { }
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



    function __historyAsObj(v) {
      if (!v) return null;
      if (typeof v === 'object') return v;
      if (typeof v !== 'string') return null;
      try {
        var o = JSON.parse(v);
        return (o && typeof o === 'object') ? o : null;
      } catch (_) {
        return null;
      }
    }

    function __historyPickEvent(it) {
      if (!it || typeof it !== 'object') return null;
      var a = __historyAsObj(it.event_after) || it.event_after;
      if (a && typeof a === 'object') return a;
      var b = __historyAsObj(it.event_before) || it.event_before;
      if (b && typeof b === 'object') return b;
      var p = __historyAsObj(it.payload) || it.payload;
      if (p && typeof p === 'object') {
        if (p.event && typeof p.event === 'object') return p.event;
        return p;
      }
      return null;
    }

    function __historyDiffEvent(before, after) {
      var out = [];
      before = __historyAsObj(before) || before;
      after = __historyAsObj(after) || after;
      if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return out;
      var fields = [
        ['title', 'назва'],
        ['description', 'опис'],
        ['time', 'час'],
        ['start_date', 'дата початку'],
        ['end_date', 'дата завершення'],
        ['owner', 'відповідальний'],
        ['type', 'тип'],
        ['urgent', 'терміновість'],
        ['done', 'виконана'],
        ['incoming_no', 'вхідний №'],
        ['outgoing_no', 'вихідний №']
      ];
      for (var i = 0; i < fields.length; i++) {
        var k = fields[i][0], label = fields[i][1];
        var a = (before[k] === undefined || before[k] === null) ? '' : String(before[k]);
        var b = (after[k] === undefined || after[k] === null) ? '' : String(after[k]);
        if (a !== b) out.push({ key: k, label: label, from: a, to: b });
      }
      return out;
    }

    function __historyBool(v) {
      if (v === true || v === 1) return true;
      var s = String(v == null ? '' : v).toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    }

    function __historyActor(it) {
      if (it && it.user_name && String(it.user_name).trim() !== '') return String(it.user_name).trim();
      var uid = parseInt((it && it.user_id) || 0, 10) || 0;
      return uid > 0 ? ('ID ' + uid) : 'система';
    }

    function __historyTs(it) {
      var raw = String((it && (it.ts || it.created_at)) || '');
      if (!raw) return '—';
      return raw.replace('T', ' ').slice(0, 16);
    }


    function __historyRawData(it) {
      if (!it || typeof it !== 'object') return null;
      function parsed(v) { return __historyAsObj(v) || v || null; }
      var out = {
        action: String(it.action || ''),
        ts: String(it.ts || it.created_at || ''),
        user_id: (it.user_id == null ? null : it.user_id),
        user_name: (it.user_name == null ? null : it.user_name),
        entity_type: (it.entity_type == null ? null : it.entity_type),
        entity_id: (it.entity_id == null ? null : it.entity_id),
        payload: parsed(it.payload),
        event_before: parsed(it.event_before),
        event_after: parsed(it.event_after)
      };
      if (it.done !== undefined) out.done = __historyBool(it.done);
      if (it.urgent !== undefined) out.urgent = __historyBool(it.urgent);
      return out;
    }

    function __historyRawHtml(it) {
      var raw = __historyRawData(it);
      if (!raw) return '';
      try {
        var jsonText = JSON.stringify(raw, null, 2) || '';
        if (!jsonText) return '';
        return '<details class="info-history-raw info-history-raw-inline"><summary title="Сирі дані (JSON)" aria-label="Сирі дані (JSON)"></summary><pre>' + Ev.escapeHtml(jsonText) + '</pre></details>';
      } catch (_) {
        return '';
      }
    }

    function __historyFieldLabelList(diff, maxCount) {
      var labels = [];
      var seen = {};
      for (var i = 0; i < diff.length; i++) {
        var label = String((diff[i] && diff[i].label) || '').trim();
        if (!label) continue;
        if (seen[label]) continue;
        seen[label] = true;
        labels.push(label);
        if (labels.length >= (maxCount || 4)) break;
      }
      return labels;
    }

    function __historyVal(v, key) {
      var s = (v === undefined || v === null || v === '') ? '—' : String(v);
      if (key === 'owner') {
        try {
          if (Ev && typeof Ev.parseOwnerField === 'function') {
            var p = Ev.parseOwnerField(v);
            if (p && p.type === 'user') {
              if (p.label) return p.label;
              if (p.name && p.login) return p.name + ' (' + p.login + ')';
              if (p.login) return p.login;
              if (p.user_id) return 'ID ' + p.user_id;
              return '—';
            }
            if (p && p.type === 'text') {
              return (p.text && String(p.text).trim()) ? String(p.text).trim() : '—';
            }
          }
        } catch (_) { }
      }
      if (key === 'type' && s !== '—') {
        try { s = Ev.labelForType(s); } catch (_) { }
      }
      if (key === 'urgent' || key === 'done') {
        s = __historyBool(v) ? 'так' : 'ні';
      }
      return s;
    }


function __historyBuildLine(it, currentEvent) {
  var action = String((it && it.action) || '');
  var ev = __historyPickEvent(it) || currentEvent || {};
  var title = (ev && ev.title) ? String(ev.title) : '';
  var actor = __historyActor(it);
  var line = 'Зміна події';
  var diff = [];
  var titleChange = null;

  if (action === 'calendar.event.create') {
    line = 'Користувач "' + actor + '" створив подію' + (title ? (' "' + title + '"') : '');
  } else if (action === 'calendar.event.delete') {
    line = 'Користувач "' + actor + '" видалив подію' + (title ? (' "' + title + '"') : '');
  } else if (action === 'calendar.event.done') {
    var done = __historyBool(it && it.done);
    line = 'Користувач "' + actor + '" ' + (done ? 'відмітив подію як "Виконана"' : 'зняв ознаку "Виконана"');
  } else if (action === 'calendar.event.urgent') {
    var urg = __historyBool(it && it.urgent);
    line = 'Користувач "' + actor + '" ' + (urg ? 'позначив подію як "Термінова"' : 'зняв позначку "Термінова"');
  } else if (action === 'calendar.event.update') {
    diff = __historyDiffEvent(it && it.event_before, it && it.event_after);
    for (var di = 0; di < diff.length; di++) {
      if (diff[di].key === 'title') { titleChange = diff[di]; break; }
    }
    if (titleChange && diff.length === 1) {
      line = 'Користувач "' + actor + '" змінив назву на "' + (titleChange.to || '') + '" ('
        + '"' + __historyVal(titleChange.from, titleChange.key) + '" → "' + __historyVal(titleChange.to, titleChange.key) + '"' + ')';
    } else if (diff.length === 1) {
      line = 'Користувач "' + actor + '" змінив поле "' + diff[0].label + '" ('
        + '"' + __historyVal(diff[0].from, diff[0].key) + '" → "' + __historyVal(diff[0].to, diff[0].key) + '"' + ')';
    } else if (diff.length > 1) {
      var labels = __historyFieldLabelList(diff, 4);
      line = 'Користувач "' + actor + '" змінив поля: ' + labels.join(', ');
      if (diff.length > labels.length) line += ' …';
    } else {
      line = 'Користувач "' + actor + '" оновив подію';
    }
  } else if (action === 'calendar.event.close') {
    line = 'Користувач "' + actor + '" закрив подію';
  } else {
    line = (action || 'Подія');
  }

  return { line: line, rawHtml: __historyRawHtml(it) };
}

function __bindEventHistoryRowToggle(host) {
      if (!host || host.__eventHistoryRowToggleBound) return;
      host.__eventHistoryRowToggleBound = true;
      host.addEventListener('click', function (ev) {
        var t = ev && ev.target ? ev.target : null;
        if (!t) return;
        // Let native <summary> click work as-is.
        if (t.closest && t.closest('.info-history-raw summary')) return;
        // Do not toggle when clicking opened JSON block.
        if (t.closest && t.closest('.info-history-raw pre')) return;
        // Avoid accidental toggle while selecting text.
        try {
          var sel = (window.getSelection && String(window.getSelection() || '')) || '';
          if (sel && sel.trim() !== '') return;
        } catch (_) { }
        var line = t.closest ? t.closest('.info-history-item.has-raw .info-history-line') : null;
        if (!line || (host.contains && !host.contains(line))) return;
        var raw = line.querySelector ? line.querySelector('.info-history-raw') : null;
        if (!raw) return;
        raw.open = !raw.open;
        ev.preventDefault();
      });
    }

function __setEventHistoryTitleCount(host, count) {
      try {
        var wrap = host && host.closest ? host.closest('.info-history-wrap') : null;
        var strong = wrap && wrap.querySelector ? wrap.querySelector('.info-history-head strong') : null;
        if (!strong) return;
        var n = parseInt(count, 10);
        if (!isFinite(n) || n < 0) n = 0;
        strong.textContent = 'Історія змін (' + String(n) + ')';
      } catch (_) { }
    }

function __renderEventHistory(host, items, currentEvent) {
      if (!host) return;
      __bindEventHistoryRowToggle(host);
      var rows = Array.isArray(items) ? items.slice() : [];
      rows = rows.filter(function (it) {
        return it && String(it.entity_type || '') === 'event';
      });
      __setEventHistoryTitleCount(host, rows.length);
      if (!rows.length) {
        host.innerHTML = '<div class="info-history-empty">Історія змін поки відсутня.</div>';
        return;
      }
      // API returns DESC, show old -> new for readable timeline.
      rows.reverse();
      var html = '';
      for (var i = 0; i < rows.length; i++) {
        var it = rows[i];
        var h = __historyBuildLine(it, currentEvent || null);
        var hasRaw = !!(h && h.rawHtml);
        html += '<div class="info-history-item' + (hasRaw ? ' has-raw' : '') + '">'
          + '<div class="info-history-line"><span class="info-history-ts">' + Ev.escapeHtml(__historyTs(it)) + '</span><span class="info-history-text">' + Ev.escapeHtml(h.line || '') + '</span>' + (h.rawHtml || '') + '</div>'
          + '</div>';
      }
      host.innerHTML = html;
    }

    function __loadEventHistory(eventId, currentEvent) {
      var host = $id('infoHistoryList');
      if (!host) return;
      host.innerHTML = '<div class="info-history-loading">Завантаження історії…</div>';
      __setEventHistoryTitleCount(host, 0);
      try {
        var qs = new URLSearchParams();
        qs.set('scope', 'all');
        qs.set('limit', '100');
        qs.set('entity_type', 'event');
        qs.set('entity_id', String(eventId || ''));
        fetch('/api/audit/list?' + qs.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin'
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j || j.ok !== true) {
              var msg = (j && (j.message || j.error)) ? String(j.message || j.error) : 'Помилка';
              host.innerHTML = '<div class="info-history-error">Історія: ' + Ev.escapeHtml(msg) + '</div>';
              __setEventHistoryTitleCount(host, 0);
              return;
            }
            __renderEventHistory(host, j.items || [], currentEvent || null);
          })
          .catch(function () {
            host.innerHTML = '<div class="info-history-error">Історія: помилка завантаження</div>';
            __setEventHistoryTitleCount(host, 0);
          });
      } catch (_) {
        host.innerHTML = '<div class="info-history-error">Історія: недоступно</div>';
        __setEventHistoryTitleCount(host, 0);
      }
    }

    function __canShowEventHistory() {
      try {
        if (infoOverlay && infoOverlay.dataset) {
          var v = String(infoOverlay.dataset.isAdmin || '').trim().toLowerCase();
          if (v === '1' || v === 'true' || v === 'yes') return true;
          if (v === '0' || v === 'false' || v === 'no') return false;
        }
      } catch (_) { }
      return (__me && __me.isAdmin === true);
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
      '<div id="infoSeenBlock" class="info-seen-block"><div class="muted">Завантаження переглядів…</div></div>' +
      __infoThreadHtml() +
      (__canShowEventHistory() ? (
        '<details class="info-history-wrap">' +
          '<summary class="info-history-head"><strong>Історія змін</strong></summary>' + // P15.34: whole block collapsible by triangle
          '<div id="infoHistoryList" class="info-history-list"><div class="info-history-loading">Завантаження історії…</div></div>' +
        '</details>'
      ) : '');
if (infoContent) infoContent.innerHTML = html;
    __setInfoHeaderBadges(ev, dateISO);
    setInfoModalType(ev.type);

    try { __loadSeenByEvent(ev.id); } catch (_) { }
    if (__canShowEventHistory()) {
      try { __loadEventHistory(ev.id, ev); } catch (_) { }
    }


    if (infoOverlay) {
      infoOverlay.classList.add('show');
      infoOverlay.setAttribute('aria-hidden', 'false');
      infoOverlay.removeAttribute('inert');

      try { __threadReset(ev.id); __bindInfoThread(ev.id); } catch (_) { }

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