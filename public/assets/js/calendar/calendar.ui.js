/* calendar.ui.js — інтерфейс: DOM, рендер, модалки, таймлайн, чат, індикатор */
(function (global) {
  "use strict";

  var Data = (global.CalendarApp && global.CalendarApp.data) || {};
  var Ev = (global.CalendarApp && global.CalendarApp.events) || {};

  function __ownerText(ev) {
    try {
      if (Ev && typeof Ev.ownerDisplay === 'function') return Ev.ownerDisplay(ev) || '';
    } catch (_) { }
    return (ev && ev.owner) ? String(ev.owner) : '';
  }


  function __ownerUserId(ev) {
    try {
      if (Ev && typeof Ev.ownerUserId === 'function') return parseInt(Ev.ownerUserId(ev) || 0, 10) || 0;
    } catch (_) { }
    return 0;
  }

  /* ===== Стан інтерфейсу ===== */
  var locale = 'uk-UA';
  var today = new Date();
  var state = { year: today.getFullYear(), month: today.getMonth() };
  var weekdayShortFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  var currentType = 'all';

  // Page mode: /today shows only the Today panel (no calendar grid/month navigation)
  var __TODAY_ONLY = (function () {
    try {
      var p = (global.location && global.location.pathname) ? String(global.location.pathname) : '';
      p = p.replace(/\/+$/, '') || '/';
      return (p === '/today');
    } catch (_) {
      return false;
    }
  })();

  var __CALENDAR_PAGE = (function () {
    try {
      var p = (global.location && global.location.pathname) ? String(global.location.pathname) : '';
      p = p.replace(/\/+$/, '') || '/';
      return (p === '/calendar');
    } catch (_) {
      return false;
    }
  })();

  var __SCROLL_RESTORE_KEY = 'calendar.page.scroll.restore';
  var __SCROLL_RESTORE_APPLIED = false;

  function __saveCalendarScrollPosition() {
    if (!__CALENDAR_PAGE) return;
    try {
      var payload = JSON.stringify({
        x: Math.max(0, global.scrollX || 0),
        y: Math.max(0, global.scrollY || 0),
        ts: Date.now()
      });
      sessionStorage.setItem(__SCROLL_RESTORE_KEY, payload);
    } catch (_) { }
  }

  function __readCalendarScrollPosition() {
    if (!__CALENDAR_PAGE) return null;
    try {
      var raw = sessionStorage.getItem(__SCROLL_RESTORE_KEY) || '';
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      var x = Math.max(0, parseInt(data.x, 10) || 0);
      var y = Math.max(0, parseInt(data.y, 10) || 0);
      var ts = parseInt(data.ts, 10) || 0;
      if ((Date.now() - ts) > 10 * 60 * 1000) return null;
      return { x: x, y: y };
    } catch (_) {
      return null;
    }
  }

  function __applyPendingCalendarScrollRestore() {
    if (!__CALENDAR_PAGE || __SCROLL_RESTORE_APPLIED) return;
    var pos = __readCalendarScrollPosition();
    if (!pos) return;
    __SCROLL_RESTORE_APPLIED = true;
    try {
      if (global.history && 'scrollRestoration' in global.history) {
        global.history.scrollRestoration = 'manual';
      }
    } catch (_) { }
    var restore = function () {
      try { global.scrollTo(pos.x, pos.y); } catch (_) { }
    };
    try { requestAnimationFrame(restore); } catch (_) { restore(); }
    try { setTimeout(restore, 0); } catch (_) { }
    try { setTimeout(restore, 120); } catch (_) { }
    try { setTimeout(restore, 300); } catch (_) { }
    try { sessionStorage.removeItem(__SCROLL_RESTORE_KEY); } catch (_) { }
  }

  if (__CALENDAR_PAGE) {
    try {
      if (global.history && 'scrollRestoration' in global.history) {
        global.history.scrollRestoration = 'manual';
      }
    } catch (_) { }
    try { global.addEventListener('beforeunload', __saveCalendarScrollPosition, { capture: true }); } catch (_) { }
    try { global.addEventListener('pagehide', __saveCalendarScrollPosition, { capture: true }); } catch (_) { }
  }

  // Current user (for marking "my" events in the calendar grid)
  var __ME_ID = 0;
  var __ME_FETCH_STARTED = false;
  var __ME_READY = false;

  function __ensureMeLoaded() {
    if (__ME_FETCH_STARTED) return;
    __ME_FETCH_STARTED = true;
    try {
      fetch('/api/users/me')
        .then(function (r) { return r.json(); })
        .then(function (x) {
          try {
            if (x && x.ok && x.user && x.user.id != null) {
              var id = parseInt(x.user.id, 10) || 0;
              if (id > 0) __ME_ID = id;
            }
          } catch (_) { }
          __ME_READY = true;
          try { if (typeof withStableScroll === 'function') withStableScroll(renderAllFn); else renderAllFn(); } catch (_) { }
          try { __applyPendingCalendarScrollRestore(); } catch (_) { }
        })
        .catch(function () {
          __ME_READY = true;
        });
    } catch (_) {
      __ME_READY = true;
    }
  }

  function __isMyEvent(ev) {
    if (!ev) return false;
    if (!__ME_READY) return false;
    if (!__ME_ID) return false;
    var uid = parseInt(ev.user_id || 0, 10) || 0;
    return (uid > 0 && uid === __ME_ID);
  }


  function __isAssignedToMe(ev) {
    if (!ev) return false;
    if (!__ME_READY) return false;
    if (!__ME_ID) return false;
    if (ev && ev.done) return false;
    var ownerUid = __ownerUserId(ev);
    return (ownerUid > 0 && ownerUid === __ME_ID);
  }


  var todayLabel = $('todayLabel'); // +
  var todayPanelDate = $('todayPanelDate'); // +

  var filterText = $('filterText'); // 12

  var quickFilters = $('quickFilters');


  /* ===== Full-search on Enter (replaces calendar grid with list like "Планування") ===== */
  var calendarSearchResults = document.getElementById('calendarSearchResults');
  var calendarWeekdays = document.getElementById('weekdays');
  var calendarGrid = document.getElementById('grid');
  var calendarBottomActions = document.querySelector('.calendar .bottom-actions');
  var calendarLegends = document.querySelectorAll('.calendar .legend');

  var __fullSearchActive = false;
  var __fullSearchLastQuery = '';

  function __setCalendarContentHidden(hidden) {
    if (calendarWeekdays) calendarWeekdays.style.display = hidden ? 'none' : '';
    if (calendarGrid) calendarGrid.style.display = hidden ? 'none' : '';
    if (calendarBottomActions) calendarBottomActions.style.display = hidden ? 'none' : '';
    if (calendarLegends && calendarLegends.length) {
      for (var i = 0; i < calendarLegends.length; i++) {
        var el = calendarLegends[i];
        if (!el) continue;
        // Keep the top type filters bar visible
        if (el.id === 'typeFiltersBar') continue;
        el.style.display = hidden ? 'none' : '';
      }
    }
  }

  function __pad2(n) { return ('0' + n).slice(-2); }

  function __isoToShortDM(iso) {
    var s = String(iso || '').slice(0, 10);
    var a = s.split('-');
    if (a.length !== 3) return s;
    return __pad2(a[2]) + '.' + __pad2(a[1]);
  }

  function __timeToMin(hhmm) {
    if (!hhmm) return 0;
    var a = String(hhmm).split(':');
    if (a.length < 2) return 0;
    var h = parseInt(a[0], 10), m = parseInt(a[1], 10);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  }

  function __renderSearchEmpty(container, query) {
    var sec = document.createElement('div');
    sec.className = 'planning-section';

    var h = document.createElement('div');
    h.className = 'planning-section__title';
    h.textContent = 'Результати пошуку: "' + (query || '') + '"';

    var empty = document.createElement('div');
    empty.className = 'planning-empty';
    empty.textContent = 'Нічого не знайдено';

    sec.appendChild(h);
    sec.appendChild(empty);
    container.appendChild(sec);
  }

  function __renderSearchResults(container, query, matches) {
    var sec = document.createElement('div');
    sec.className = 'planning-section';

    var h = document.createElement('div');
    h.className = 'planning-section__title';

    var title = document.createElement('span');
    title.textContent = 'Результати пошуку: "' + (query || '') + '"';

    var meta = document.createElement('span');
    meta.className = 'planning-section__date';
    meta.textContent = 'знайдено: ' + (matches.length || 0);

    h.appendChild(title);
    h.appendChild(meta);

    var ul = document.createElement('ul');
    ul.className = 'planning-today__list';

    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      var dateISO = m.dateISO;
      var ev = m.ev;
      if (!ev) continue;

      var li = document.createElement('li');
      li.className = 'planning-today__item';
      if (ev.urgent) li.classList.add('urgent');
      if (ev.done) li.classList.add('done');

      // multi-day hint
      try {
        var s = (ev.start_date || dateISO || '').slice(0, 10);
        var e = (ev.end_date || '').slice(0, 10);
        if (e && s && e !== s) li.classList.add('ev--multi');
      } catch (_) { }

      var time = document.createElement('div');
      time.className = 'planning-today__time';
      var tm = (ev.time && String(ev.time).trim()) ? String(ev.time).trim() : '00:00';
      time.textContent = __isoToShortDM(dateISO) + '\n' + tm;

      var details = document.createElement('div');
      details.className = 'planning-today__details';

      var head = document.createElement('div');
      head.className = 'planning-today__head';

      var tRaw = ev.type || 'evt';
      var chip = document.createElement('span');
      chip.className = 'chip ' + (tRaw === 'mi' ? 'mi' : tRaw === 'nas' ? 'nas' : tRaw === 'evt' ? 'evt' : 'other');
      chip.textContent = (Ev.labelForType ? Ev.labelForType(tRaw) : tRaw);

      var p = document.createElement('span');
      p.className = 'planning-today__title';
      p.textContent = ev.title || '(без назви)';

      head.appendChild(chip);
      head.appendChild(p);

      var owner = document.createElement('span');
      owner.className = 'planning-today__owner';
      owner.textContent = __ownerText(ev);

      details.appendChild(head);
      if (__ownerText(ev)) details.appendChild(owner);

      li.appendChild(time);
      li.appendChild(details);

      // click -> open info (shift-click -> edit)
      (function (dISO, id) {
        li.addEventListener('click', function (e) {
          var ui = (window.CalendarApp && window.CalendarApp.ui) || {};
          try {
            if (e && e.shiftKey && ui.openModalEdit) ui.openModalEdit(dISO, id);
            else if (ui.openInfo) ui.openInfo(dISO, id);
          } catch (_) { }
        });
      })(dateISO, ev.id);

      ul.appendChild(li);
    }

    sec.appendChild(h);
    sec.appendChild(ul);
    container.appendChild(sec);
  }

  function __collectFullSearchMatches(query) {
    var qRaw = String(query || '').trim();
    if (!qRaw) return [];

    var store = Data.readStore();

    // Keep the same type/overdue filtering logic, but handle text matching locally (OR)
    var typeMatcher = Ev.buildMatcher ? Ev.buildMatcher(currentType, '', { meId: __ME_ID }) : null;
    if (!typeMatcher) return [];

    var qNormRaw = (Ev.norm ? Ev.norm(qRaw) : String(qRaw).toLowerCase());

    // Full-search tokens:
    //   "+word" => REQUIRED (AND)
    //   "word"  => OPTIONAL (OR)
    // Semantics:
    //   - if there are REQUIRED tokens: all of them must match
    //   - if there are OPTIONAL tokens: at least one of them must match
    var qReq = [];
    var qOpt = [];
    if (qNormRaw) {
      var parts = qNormRaw.split(' ');
      for (var pi = 0; pi < parts.length; pi++) {
        var tok0 = parts[pi];
        if (!tok0) continue;

        var isReq = (tok0.charAt(0) === '+');
        var tok = isReq ? tok0.slice(1) : tok0;
        if (!tok) continue;

        // keep short numeric tokens (e.g. "123"), otherwise require at least 2 chars
        if (tok.length >= 2 || /\d/.test(tok)) (isReq ? qReq : qOpt).push(tok);
      }
      // If everything was filtered out as "too short", fallback to the whole query (without leading '+')
      if (qReq.length === 0 && qOpt.length === 0) {
        var fallback = qNormRaw.replace(/^\+/, '');
        if (fallback) qOpt = [fallback];
      }
    }

    function textMatches(ev) {
      if (!qNormRaw) return true;
      var hay = (Ev.norm
        ? Ev.norm(((ev && ev.title) || '') + ' ' + (__ownerText(ev) || ''))
        : (((ev && ev.title) || '') + ' ' + (__ownerText(ev) || '')).toLowerCase());

      // Required tokens must all exist
      for (var ri = 0; ri < qReq.length; ri++) {
        if (hay.indexOf(qReq[ri]) === -1) return false;
      }

      // Optional tokens: OR
      if (qOpt.length === 0) return (qReq.length > 0); // only required tokens defined
      for (var oi = 0; oi < qOpt.length; oi++) {
        if (hay.indexOf(qOpt[oi]) !== -1) return true;
      }
      return false;
    }

    var out = [];
    for (var dateISO in store) {
      if (!Object.prototype.hasOwnProperty.call(store, dateISO)) continue;
      var arr = store[dateISO];
      if (!Array.isArray(arr) || !arr.length) continue;
      for (var i = 0; i < arr.length; i++) {
        var ev = arr[i];
        try {
          if (typeMatcher(ev) && textMatches(ev)) out.push({ dateISO: dateISO, ev: ev });
        } catch (_) { }
      }
    }

    out.sort(function (a, b) {
      if (a.dateISO !== b.dateISO) return a.dateISO < b.dateISO ? 1 : -1; // newest first
      return __timeToMin(a.ev && a.ev.time) - __timeToMin(b.ev && b.ev.time);
    });

    return out;
  }

  function __searchActionSvg(name) {
    switch (String(name || '')) {
      case 'preview':
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case 'download':
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v10m0 0 4-4m-4 4-4-4M5 18.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case 'comment':
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18.5V7.8A2.8 2.8 0 0 1 7.8 5h8.4A2.8 2.8 0 0 1 19 7.8v5.4A2.8 2.8 0 0 1 16.2 16H10l-5 2.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      default:
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
    }
  }

  function __searchEsc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function __searchTypeLabel(type) {
    try { return Ev.labelForType ? Ev.labelForType(type || 'evt') : String(type || ''); } catch (_) { return String(type || ''); }
  }

  function __searchFormatDateTime(dateISO, time) {
    var d = String(dateISO || '').slice(0, 10);
    var t = String(time || '').trim();
    return __isoToShortDM(d) + (t ? (' ' + t) : '');
  }

  function __searchSnippet(text, limit) {
    var raw = String(text || '').replace(/\s+/g, ' ').trim();
    var max = Math.max(40, parseInt(limit || 0, 10) || 140);
    if (raw.length <= max) return raw;
    return raw.slice(0, max - 1).trim() + '…';
  }

  function __searchFormatBytes(n) {
    var num = Number(n || 0);
    if (!isFinite(num) || num < 0) num = 0;
    if (num < 1024) return num + ' B';
    if (num < 1024 * 1024) return (Math.round((num / 1024) * 10) / 10) + ' KB';
    if (num < 1024 * 1024 * 1024) return (Math.round((num / 1024 / 1024) * 10) / 10) + ' MB';
    return (Math.round((num / 1024 / 1024 / 1024) * 10) / 10) + ' GB';
  }


  function __searchFileIcon(item) {
    item = item || {};
    var mime = String(item.mime_type || '').toLowerCase();
    var name = String(item.original_name || '').toLowerCase();
    if ((item.is_image) || (mime.indexOf('image/') === 0) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return '🖼';
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return '📄';
    if (mime.indexOf('text/') === 0 || mime === 'application/json' || mime === 'application/xml' || mime === 'text/xml' || /\.(txt|log|md|csv|json|xml|ya?ml|ini|cfg|conf|sql)$/i.test(name)) return '📄';
    return '📎';
  }

  function __searchFetchExtended(query) {
    var params = new URLSearchParams();
    params.set('q', String(query || '').trim());
    params.set('limit', '20');
    if (currentType && currentType !== 'all') params.set('type', currentType);
    return fetch('/api/events/search-extended?' + params.toString(), {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (data) {
        if (!response.ok || !data || data.ok === false) {
          var msg = data && (data.message || data.error) ? String(data.message || data.error) : ('HTTP ' + response.status);
          throw new Error(msg);
        }
        return data;
      });
    });
  }

  function __searchEnsureEventInStore(eventId) {
    eventId = String(eventId || '').trim();
    if (!eventId) return Promise.reject(new Error('event id required'));
    var store = (Data && Data.readStore) ? (Data.readStore() || {}) : {};
    for (var dateISO in store) {
      if (!Object.prototype.hasOwnProperty.call(store, dateISO)) continue;
      var arr = Array.isArray(store[dateISO]) ? store[dateISO] : [];
      for (var i = 0; i < arr.length; i++) {
        var ev = arr[i];
        if (ev && String(ev.id || '') === eventId) {
          return Promise.resolve({ event: ev, dateISO: String((ev._date || ev.start_date || dateISO) || '').slice(0, 10) });
        }
      }
    }

    return fetch('/api/events/get?id=' + encodeURIComponent(eventId), {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (data) {
        if (!response.ok || !data || data.ok === false || !data.event) {
          var msg = data && (data.message || data.error) ? String(data.message || data.error) : ('HTTP ' + response.status);
          throw new Error(msg);
        }
        var eventRow = data.event || {};
        var dateISO = String((eventRow._date || eventRow.start_date || '')).slice(0, 10);
        if (!dateISO) throw new Error('event date missing');
        try {
          if (Data && typeof Data.readStore === 'function' && typeof Data.writeStore === 'function') {
            var current = Data.readStore() || {};
            var next = Object.assign({}, current);
            var bucket = Array.isArray(next[dateISO]) ? next[dateISO].slice() : [];
            var replaced = false;
            for (var bi = 0; bi < bucket.length; bi++) {
              if (bucket[bi] && String(bucket[bi].id || '') === String(eventRow.id || '')) {
                bucket[bi] = eventRow;
                replaced = true;
                break;
              }
            }
            if (!replaced) bucket.push(eventRow);
            next[dateISO] = bucket;
            Data.writeStore(next);
          }
        } catch (_) { }
        return { event: eventRow, dateISO: dateISO };
      });
    });
  }

  function __searchOpenEventContext(item, opts) {
    item = item || {};
    opts = (opts && typeof opts === 'object') ? opts : {};
    var eventId = String(item.event_id || item.id || '').trim();
    if (!eventId) return;
    __searchEnsureEventInStore(eventId)
      .then(function (ctx) {
        var ui = (window.CalendarApp && window.CalendarApp.ui) || {};
        if (ui && typeof ui.openInfo === 'function') {
          ui.openInfo(ctx.dateISO, eventId, opts);
        }
      })
      .catch(function (error) {
        try { alert('Не вдалося відкрити подію: ' + (error && error.message ? error.message : 'помилка')); } catch (_) { }
      });
  }

  function __renderSearchEventSection(container, query, matches) {
    var sec = document.createElement('div');
    sec.className = 'planning-section';

    var h = document.createElement('div');
    h.className = 'planning-section__title';

    var title = document.createElement('span');
    title.textContent = 'Результати пошуку: "' + (query || '') + '"';

    var meta = document.createElement('span');
    meta.className = 'planning-section__date';
    meta.textContent = 'знайдено: ' + (matches.length || 0);

    h.appendChild(title);
    h.appendChild(meta);
    sec.appendChild(h);

    if (!matches.length) {
      var empty = document.createElement('div');
      empty.className = 'planning-empty';
      empty.textContent = 'Події не знайдено';
      sec.appendChild(empty);
      container.appendChild(sec);
      return;
    }

    var ul = document.createElement('ul');
    ul.className = 'planning-today__list';

    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      var dateISO = m.dateISO;
      var ev = m.ev;
      if (!ev) continue;

      var li = document.createElement('li');
      li.className = 'planning-today__item';
      if (ev.urgent) li.classList.add('urgent');
      if (ev.done) li.classList.add('done');
      try {
        var s = (ev.start_date || dateISO || '').slice(0, 10);
        var e = (ev.end_date || '').slice(0, 10);
        if (e && s && e !== s) li.classList.add('ev--multi');
      } catch (_) { }

      var time = document.createElement('div');
      time.className = 'planning-today__time';
      var tm = (ev.time && String(ev.time).trim()) ? String(ev.time).trim() : '00:00';
      time.textContent = __isoToShortDM(dateISO) + "\n" + tm;

      var details = document.createElement('div');
      details.className = 'planning-today__details';

      var head = document.createElement('div');
      head.className = 'planning-today__head';

      var tRaw = ev.type || 'evt';
      var chip = document.createElement('span');
      chip.className = 'chip ' + (tRaw === 'mi' ? 'mi' : tRaw === 'nas' ? 'nas' : tRaw === 'evt' ? 'evt' : 'other');
      chip.textContent = (Ev.labelForType ? Ev.labelForType(tRaw) : tRaw);

      var p = document.createElement('span');
      p.className = 'planning-today__title';
      p.textContent = ev.title || '(без назви)';

      head.appendChild(chip);
      head.appendChild(p);

      var owner = document.createElement('span');
      owner.className = 'planning-today__owner';
      owner.textContent = __ownerText(ev);

      details.appendChild(head);
      if (__ownerText(ev)) details.appendChild(owner);

      li.appendChild(time);
      li.appendChild(details);

      (function (dISO, id) {
        li.addEventListener('click', function (e) {
          var ui = (window.CalendarApp && window.CalendarApp.ui) || {};
          try {
            if (e && e.shiftKey && ui.openModalEdit) ui.openModalEdit(dISO, id);
            else if (ui.openInfo) ui.openInfo(dISO, id);
          } catch (_) { }
        });
      })(dateISO, ev.id);

      ul.appendChild(li);
    }

    sec.appendChild(ul);
    container.appendChild(sec);
  }

  function __renderSearchCommentsSection(container, comments) {
    comments = Array.isArray(comments) ? comments : [];
    if (!comments.length) return;

    var sec = document.createElement('div');
    sec.className = 'planning-section';
    sec.innerHTML = '<div class="planning-section__title"><span>Коментарі</span><span class="planning-section__date">знайдено: ' + comments.length + '</span></div>';
    var list = document.createElement('div');
    list.className = 'calendar-search-comments';

    comments.forEach(function (item) {
      var row = document.createElement('article');
      row.className = 'calendar-search-comment';
      row.innerHTML = ''
        + '<div class="calendar-search-comment__head">'
        +   '<div class="calendar-search-comment__title">' + __searchEsc(String(item.event_title || '(без назви події)')) + '</div>'
        +   '<div class="calendar-search-comment__type">' + __searchEsc(__searchTypeLabel(item.event_type)) + '</div>'
        + '</div>'
        + '<div class="calendar-search-comment__meta">' + __searchEsc(__searchFormatDateTime(item.event_date, item.event_time)) + ' · Автор: ' + __searchEsc((((item.author || {}).display) || ((item.author || {}).name) || ((item.author || {}).login) || '—')) + '</div>'
        + '<div class="calendar-search-comment__text">' + __searchEsc(__searchSnippet(item.message_text, 220)) + '</div>';
      var actions = document.createElement('div');
      actions.className = 'calendar-search-comment__actions';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'info-thread-icon-action info-thread-icon-action--edit';
      btn.title = 'До коментаря';
      btn.setAttribute('aria-label', 'До коментаря');
      btn.innerHTML = __searchActionSvg('comment');
      btn.addEventListener('click', function () {
        __searchOpenEventContext(item, { focusMessageId: item.id });
      });
      actions.appendChild(btn);
      row.appendChild(actions);
      list.appendChild(row);
    });

    sec.appendChild(list);
    container.appendChild(sec);
  }

  function __renderSearchFilesSection(container, files) {
    files = Array.isArray(files) ? files : [];
    if (!files.length) return;

    var sec = document.createElement('div');
    sec.className = 'planning-section';
    sec.innerHTML = '<div class="planning-section__title"><span>Файли</span><span class="planning-section__date">знайдено: ' + files.length + '</span></div>';
    var list = document.createElement('div');
    list.className = 'calendar-search-files info-thread-files';

    files.forEach(function (item) {
      var fileType = String(item.mime_type || 'application/octet-stream');
      var fileName = String(item.original_name || 'file');
      var row = document.createElement('div');
      row.className = 'info-files-item calendar-search-file';
      row.innerHTML = ''
        + '<div class="info-files-item__icon" aria-hidden="true">' + __searchFileIcon(item) + '</div>'
        + '<div class="info-files-item__body">'
        +   '<div class="info-files-item__top">'
        +     '<div class="calendar-search-file__title-group">'
        +       '<div class="info-files-item__name">' + __searchEsc(fileName) + '</div>'
        +       '<div class="info-files-item__size">' + __searchEsc(__searchFormatBytes(item.file_size || 0)) + '</div>'
        +     '</div>'
        +     '<div class="info-files-item__actions"></div>'
        +   '</div>'
        +   '<div class="info-files-item__meta">' + __searchEsc(fileType) + ' · ' + __searchEsc(__searchFormatDateTime(item.event_date, item.event_time)) + ' · ' + __searchEsc(String(item.event_title || '(без назви події)')) + (item.message_preview ? (' · ' + __searchEsc(__searchSnippet(item.message_preview, 70))) : '') + '</div>'
        + '</div>';
      var actions = row.querySelector('.info-files-item__actions');

      var previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'info-thread-icon-action info-thread-icon-action--preview';
      previewBtn.title = 'Переглянути файл';
      previewBtn.setAttribute('aria-label', 'Переглянути файл');
      previewBtn.innerHTML = __searchActionSvg('preview');
      previewBtn.addEventListener('click', function () {
        __searchOpenEventContext(item, { previewDocId: item.id });
      });
      actions.appendChild(previewBtn);

      var downloadLink = document.createElement('a');
      downloadLink.className = 'info-thread-icon-action info-thread-icon-action--download';
      downloadLink.href = String(item.download_url || ('/api/documents/download?id=' + (item.id || '')));
      downloadLink.target = '_blank';
      downloadLink.rel = 'noopener';
      downloadLink.title = 'Завантажити файл';
      downloadLink.setAttribute('aria-label', 'Завантажити файл');
      downloadLink.innerHTML = __searchActionSvg('download');
      actions.appendChild(downloadLink);

      if ((parseInt(item.message_id || 0, 10) || 0) > 0) {
        var commentBtn = document.createElement('button');
        commentBtn.type = 'button';
        commentBtn.className = 'info-thread-icon-action info-thread-icon-action--edit';
        commentBtn.title = 'До коментаря';
        commentBtn.setAttribute('aria-label', 'До коментаря');
        commentBtn.innerHTML = __searchActionSvg('comment');
        commentBtn.addEventListener('click', function () {
          __searchOpenEventContext(item, { focusMessageId: item.message_id });
        });
        actions.appendChild(commentBtn);
      }

      list.appendChild(row);
    });

    sec.appendChild(list);
    container.appendChild(sec);
  }

  function __enterFullSearch(query) {
    if (!calendarSearchResults) return;
    var q = String(query || '').trim();
    if (!q) return;

    __fullSearchActive = true;
    __fullSearchLastQuery = q;

    __setCalendarContentHidden(true);
    calendarSearchResults.hidden = false;
    calendarSearchResults.innerHTML = '<div class="planning-section"><div class="planning-section__title"><span>Результати пошуку: &quot;' + __searchEsc(q) + '&quot;</span></div><div class="planning-empty">Завантаження…</div></div>';

    var token = q;
    var matches = __collectFullSearchMatches(q);
    __searchFetchExtended(q)
      .then(function (data) {
        if (!__fullSearchActive || __fullSearchLastQuery !== token) return;
        calendarSearchResults.innerHTML = '';
        __renderSearchEventSection(calendarSearchResults, q, matches);
        __renderSearchCommentsSection(calendarSearchResults, (data && data.comments) ? data.comments : []);
        __renderSearchFilesSection(calendarSearchResults, (data && data.files) ? data.files : []);
      })
      .catch(function (error) {
        if (!__fullSearchActive || __fullSearchLastQuery !== token) return;
        calendarSearchResults.innerHTML = '';
        __renderSearchEventSection(calendarSearchResults, q, matches);
        var err = document.createElement('div');
        err.className = 'planning-empty';
        err.textContent = 'Не вдалося завантажити коментарі/файли: ' + (error && error.message ? error.message : 'помилка');
        calendarSearchResults.appendChild(err);
      });

    try { calendarSearchResults.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) { }
  }

  function __exitFullSearch() {
    if (!calendarSearchResults) return;
    __fullSearchActive = false;
    __fullSearchLastQuery = '';

    calendarSearchResults.hidden = true;
    calendarSearchResults.innerHTML = '';
    __setCalendarContentHidden(false);
  }

  function __refreshFullSearchIfActive() {
    if (!__fullSearchActive) return;
    if (!calendarSearchResults || calendarSearchResults.hidden) return;
    var q = String(__fullSearchLastQuery || '').trim();
    if (!q) return;
    __enterFullSearch(q);
  }

  // Re-render full-search results after edits/updates (edit modal fires "calendar:changed")
  document.addEventListener('calendar:changed', function () {
    __refreshFullSearchIfActive();
  });

  // Форматери
  var monthFmt = new Intl.DateTimeFormat(locale, { month: 'long' });

  var longHeaderFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  if (todayLabel) todayLabel.textContent = longHeaderFmt.format(today).replace('.', '');
  if (todayPanelDate) todayPanelDate.textContent = longHeaderFmt.format(today).replace('.', '');

  /* ===== Today panel: collapse/expand with localStorage ===== */
  (function initTodayPanelCollapse() {
    if (__TODAY_ONLY) return;
    var layout = document.getElementById('calendarLayout') || document.querySelector('.layout');
    var panel = document.getElementById('todayPanelInner') || document.getElementById('todayPanel');
    var btn = document.getElementById('todayPanelToggle');
    if (!layout || !panel || !btn) return;

    var KEY = 'calendar.todayPanelCollapsed';

    function safeGet() {
      try { return localStorage.getItem(KEY); } catch (_) { return null; }
    }

    function safeSet(v) {
      try { localStorage.setItem(KEY, v); } catch (_) { }
    }

    function setBtn(collapsed) {
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('aria-label', collapsed ? 'Показати панель «Сьогодні»' : 'Сховати панель «Сьогодні»');
      btn.title = collapsed ? 'Показати панель «Сьогодні»' : 'Сховати панель «Сьогодні»';
      var sp = btn.querySelector('span');
      if (sp) sp.textContent = collapsed ? '‹' : '›';
      else btn.textContent = collapsed ? '‹' : '›';
    }

    var isCollapsed = (safeGet() === '1');
    layout.classList.add('today-panel-init');
    if (isCollapsed) {
      layout.classList.add('today-panel-hidden', 'today-panel-collapsed');
    }
    setBtn(isCollapsed);
    requestAnimationFrame(function () {
      layout.classList.remove('today-panel-init');
    });



    function hidePanel() {
      var collapsedNow = layout.classList.contains('today-panel-hidden') || layout.classList.contains('today-panel-collapsed');
      if (collapsedNow) return;

      // Force layout flush so transitions reliably start (Chrome/Edge)
      try { if (panel) void panel.offsetWidth; } catch (_) { }

      // Collapse the column and slide the panel out together (no "jump")
      layout.classList.add('today-panel-hidden', 'today-panel-collapsed');
      setBtn(true);
      safeSet('1');
    }

    function showPanel() {
      var collapsedNow = layout.classList.contains('today-panel-hidden') || layout.classList.contains('today-panel-collapsed');
      if (!collapsedNow) return;

      try { if (panel) void panel.offsetWidth; } catch (_) { }

      // Expand the column and slide the panel back together
      layout.classList.remove('today-panel-hidden', 'today-panel-collapsed');
      setBtn(false);
      safeSet('0');
    }

    btn.addEventListener('click', function () {
      var collapsedNow = layout.classList.contains('today-panel-hidden') || layout.classList.contains('today-panel-collapsed');
      if (collapsedNow) showPanel();
      else hidePanel();
    });
  })();


  var renderAllFn = function () {
    // console.log('renderAllFn call');
    updateTypeButtons();
    renderAllCells();
    renderTodayPanel();
  }

  // Load current user id for "my event" badge (async, safe).
  __ensureMeLoaded();

  /* ===== Фільтри типів/пошуку ===== */
  function updateTypeButtons() {
    var btnTypeMi = $('btnTypeMi');
    var btnTypeNas = $('btnTypeNas');
    var btnTypeEvt = $('btnTypeEvt');
    var btnTypeOther = $('btnTypeOther');
    var btnTypeOverdue = $('btnTypeOverdue');
    var btnTypeAssigned = $('btnTypeAssigned');
    var btnTypeMyTasks = $('btnTypeMyTasks');
    var btnTypeReset = $('btnTypeReset');


    if (!btnTypeMi) return;
    btnTypeMi.classList.toggle('active', currentType === 'mi');
    btnTypeMi.style.cursor = 'pointer';
    btnTypeNas.classList.toggle('active', currentType === 'nas');
    btnTypeNas.style.cursor = 'pointer';
    btnTypeEvt.classList.toggle('active', currentType === 'evt');
    btnTypeEvt.style.cursor = 'pointer';
    btnTypeOther.classList.toggle('active', currentType === 'other');
    btnTypeOther.style.cursor = 'pointer';
    btnTypeOverdue.classList.toggle('active', currentType === 'overdue');
    btnTypeOverdue.style.cursor = 'pointer';
    if (btnTypeAssigned) {
      btnTypeAssigned.classList.toggle('active', currentType === 'assigned');
      btnTypeAssigned.style.cursor = 'pointer';
    }
    if (btnTypeMyTasks) {
      btnTypeMyTasks.classList.toggle('active', currentType === 'my');
      btnTypeMyTasks.style.cursor = 'pointer';
    }
    if (btnTypeReset) {
      btnTypeReset.style.display = (currentType === 'all') ? 'none' : 'inline-grid';
      btnTypeReset.style.cursor = 'pointer';
    }
  }

  function setTypeFilter(t) {
    currentType = t || 'all';
    if (__fullSearchActive) {
      updateTypeButtons();
      __refreshFullSearchIfActive();
      return;
    }
    withStableScroll(renderAllFn);
  }

  var btnClearFilters = $('btnClearFilters');
  var btnTypeMi = $('btnTypeMi');
  var btnTypeNas = $('btnTypeNas');
  var btnTypeEvt = $('btnTypeEvt');
  var btnTypeOther = $('btnTypeOther');
  var btnTypeOverdue = $('btnTypeOverdue');
  var btnTypeAssigned = $('btnTypeAssigned');
  var btnTypeMyTasks = $('btnTypeMyTasks');
  var btnTypeReset = $('btnTypeReset');

  if (btnTypeMi) btnTypeMi.addEventListener('click', function () { setTypeFilter('mi'); });
  if (btnTypeNas) btnTypeNas.addEventListener('click', function () { setTypeFilter('nas'); });
  if (btnTypeEvt) btnTypeEvt.addEventListener('click', function () { setTypeFilter('evt'); });
  if (btnTypeOther) btnTypeOther.addEventListener('click', function () { setTypeFilter('other'); });
  if (btnTypeOverdue) btnTypeOverdue.addEventListener('click', function () { setTypeFilter('overdue'); });
  if (btnTypeAssigned) btnTypeAssigned.addEventListener('click', function () { setTypeFilter('assigned'); });
  if (btnTypeMyTasks) btnTypeMyTasks.addEventListener('click', function () { setTypeFilter('my'); });
  if (btnTypeReset) btnTypeReset.addEventListener('click', function () { setTypeFilter('all'); });
  if (filterText) filterText.addEventListener('input', function () {
    if (__fullSearchActive) return;
    withStableScroll(renderAllFn);
  });

  if (filterText) filterText.addEventListener('keydown', function (e) {
    if (!e) return;
    if (e.key === 'Enter') {
      try { e.preventDefault(); } catch (_) { }
      try { e.stopPropagation(); } catch (_) { }

      var v = String(filterText.value || '').trim();
      // Enter on empty string => reset and return to calendar
      if (!v) {
        if (btnClearFilters && typeof btnClearFilters.click === 'function') btnClearFilters.click();
        else {
          if (__fullSearchActive) __exitFullSearch();
          setTypeFilter('all');
        }
        return;
      }

      __enterFullSearch(v);
    }
  });


  if (btnClearFilters) btnClearFilters.addEventListener('click', function () {
    if (__fullSearchActive) __exitFullSearch();
    if (filterText) filterText.value = ''; setTypeFilter('all');
    filterText.classList.remove('type-mi', 'type-nas', 'type-evt', 'type-other', 'ev--overdue-flash');
    filterText.style.background = 'transparent';
    filterText.classList.remove('active');
  });
  if (quickFilters) quickFilters.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button[data-type]') : null;
    var tp = b.getAttribute('data-type');
    if (!b) return;
    setTypeFilter(tp);
    if (filterText) {
      filterText.value = b.getAttribute('data-text') || '';
      filterText.classList.remove('type-mi', 'type-nas', 'type-evt', 'type-other', 'ev--overdue-flash');
      // filterText.classList.add('type-' + b.getAttribute('data-type'));
      filterText.style.background = 'color-mix(in oklab, var(--type-' + tp + ') 20%, transparent)';
      filterText.classList.add('active');
    }

    withStableScroll(renderAllFn);
  });

  /* ===== Навігація місяців ===== */
  function changeMonth(delta) {
    if (__TODAY_ONLY) return;
    var m = state.month + delta, y = state.year;
    if (m < 0) { m += 12; y--; } if (m > 11) { m -= 12; y++; }
    state.month = m; state.year = y;
    renderCalendar(); // тут тільки календар!
  }

  var btnPrev = $('btnPrev');
  var btnNext = $('btnNext');
  var btnToday = $('btnToday');


  var btnClose = $('btnClose');
  var btnCancel = $('btnCancel');

  if (btnPrev) btnPrev.addEventListener('click', function () { changeMonth(-1); });
  if (btnNext) btnNext.addEventListener('click', function () { changeMonth(1); });
  if (btnToday) btnToday.addEventListener('click', function () { state.year = today.getFullYear(); state.month = today.getMonth(); renderCalendar(); });

  if (!__TODAY_ONLY) {
    window.addEventListener('keydown', function (e) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target && e.target.tagName)) return;
      if (e.key === 'ArrowLeft') changeMonth(-1);
      if (e.key === 'ArrowRight') changeMonth(1);
    });
  }

  // window.addEventListener('keydown',function(e){ if(e.key==='Escape'){ try{ closeOverlay(); }catch(_){ } try{ closeInfo(); }catch(_){ } } });
  // Do NOT early-return on inputs for Escape
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var ui = (window.CalendarApp && window.CalendarApp.ui) || {};
      try { ui.closeOverlay && ui.closeOverlay(); } catch (_) { }
      try { ui.closeInfo && ui.closeInfo(); } catch (_) { }
      // optionally: e.preventDefault(); e.stopPropagation();
      return;
    }
  });
  // Ensure close fields exist on every event (in-place)
  function migrateEnsureCloseFields(dayMap) {
    if (!dayMap || typeof dayMap !== 'object') return;
    Object.keys(dayMap).forEach(function (day) {
      var arr = dayMap[day];
      if (!Array.isArray(arr)) return;
      for (var i = 0; i < arr.length; i++) {
        var ev = arr[i];
        if (!('close_user_id' in ev)) ev.close_user_id = null;
        if (!('close_time' in ev)) ev.close_time = null;
      }
    });
  }

  // Helper: is closed?
  function isEventClosed(ev) {
    return !!(ev && ev.close_user_id && ev.close_time);
  }

  // Format closed label
  function formatClosedAt(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('uk-UA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return iso;
    }
  }

  // Apply closed styling to an event DOM node (card/label)
  // Expects: node is an element representing an event (div, a, etc.)
  function applyClosedStyles(node, ev) {
    if (!node || !ev) return;
    if (isEventClosed(ev)) {
      node.classList.add('is-closed');
      // Append closed time text if there's a title container
      var title = node.querySelector('.event-title, .title, [data-role="event-title"]');
      if (title && !title.querySelector('.closed-note')) {
        var span = document.createElement('span');
        span.className = 'closed-note';
        span.style.marginLeft = '8px';
        span.textContent = '(закрито: ' + formatClosedAt(ev.close_time) + ')';
        title.appendChild(span);
      }
    } else {
      node.classList.remove('is-closed');
      var note = node.querySelector('.closed-note');
      if (note) note.remove();
    }
  }

  // Mark as done / reopen — in-memory + server
  // You already have storeAll(dayMap) in backend API; here we'll call a small close endpoint for atomic updates.
  function closeEventById(dayMap, eventId, userId) {
    if (!dayMap || !eventId) return Promise.reject(new Error('bad args'));
    var evRef = null, evDay = null, evIdx = -1;

    Object.keys(dayMap).some(function (d) {
      var idx = -1;
      var found = (dayMap[d] || []).some(function (e, i) {
        if (e.id === eventId) { idx = i; return true; }
        return false;
      });
      if (found) { evRef = dayMap[d][idx]; evDay = d; evIdx = idx; return true; }
      return false;
    });

    if (!evRef) return Promise.reject(new Error('not found'));

    var nowIso = new Date().toISOString();
    evRef.close_user_id = userId || 'system';
    evRef.close_time = nowIso;

    // optimistic UI — server sync
    return fetch('/api/events/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: eventId, close_user_id: evRef.close_user_id, close_time: evRef.close_time })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function reopenEventById(dayMap, eventId) {
    if (!dayMap || !eventId) return Promise.reject(new Error('bad args'));
    var evRef = null;

    Object.keys(dayMap).some(function (d) {
      return (dayMap[d] || []).some(function (e) {
        if (e.id === eventId) { evRef = e; return true; }
        return false;
      });
    });

    if (!evRef) return Promise.reject(new Error('not found'));

    evRef.close_user_id = null;
    evRef.close_time = null;

    return fetch('/api/events/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: eventId, close_user_id: null, close_time: null })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ===== Фокус та стабільний скрол ===== */
  var __lastFocusEl = null;

  /* ===== Рендер календаря ===== */
  var cells = [], quarterHas = {}, hourHoverCount = {}, earlyOpen = false, lateOpen = false;

  function renderCalendar() {
    var monthLabel = $('monthLabel');
    var weekdaysEl = $('weekdays');
    var grid = $('grid');

    if (!grid) return;
    var monthName = monthFmt.format(new Date(state.year, state.month, 1));
    if (monthLabel) monthLabel.textContent = (monthName.charAt(0).toUpperCase() + monthName.slice(1)) + ' ' + state.year;

    if (weekdaysEl && weekdaysEl.children.length === 0) {
      var mondayAnchor = new Date(Date.UTC(2021, 10, 1));
      for (var i = 0; i < 7; i++) {
        var d = new Date(mondayAnchor.getTime() + i * 86400000);
        var w = document.createElement('div'); w.className = 'weekday';
        w.textContent = weekdayShortFmt.format(d).toUpperCase();
        weekdaysEl.appendChild(w);
      }
    }

    grid.innerHTML = ''; cells = [];
    var first = ((new Date(state.year, state.month, 1)).getDay() + 6) % 7;
    var dim = new Date(state.year, state.month + 1, 0).getDate();
    for (var i2 = first - 1; i2 >= 0; i2--) {
      var pd = new Date(state.year, state.month, 0).getDate() - i2; // prev month day
      var d2 = new Date(state.year, state.month - 1, pd);
      var iso = Ev.toISODate(d2);

      var cell = document.createElement('div');
      cell.className = 'cell adjacent';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', longHeaderFmt.format(d2));
      cell.dataset.date = iso;

      var head = document.createElement('div'); head.className = 'cell-head';
      var hplus = document.createElement('div'); hplus.className = 'cell-head-plus'; hplus.textContent = String('+');
      var dn = document.createElement('div'); dn.className = 'day-num'; dn.textContent = String(d2.getDate());
      head.appendChild(dn); head.appendChild(hplus); cell.appendChild(head);
      var list = document.createElement('div'); list.className = 'events'; cell.appendChild(list);

      var w = ((d2.getDay() + 6) % 7);
      if (w >= 5) cell.classList.add('weekend');
      if (Ev.sameDate(d2, today)) cell.classList.add('today');

      // UI + DnD listeners (same behavior as main cells)
      cell.addEventListener('click', function (ev) {
        var openModalNew = global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.openModalNew;
        if (!openModalNew) return;
        var c = ev.currentTarget; var iso2 = c.dataset.date;
        var headEl = c.querySelector('.cell-head'); var listEl = c.querySelector('.events');
        if (ev.target === c || ev.target === headEl || ev.target === listEl || ev.target === headEl.firstChild) { openModalNew(iso2); }
      });
      cell.addEventListener('dragenter', function (e) { e.preventDefault(); this.classList.add('drop-target'); });
      cell.addEventListener('dragover', function (e) {
        try {
          var types = e.dataTransfer && e.dataTransfer.types;
          var hasMove = false, hasResize = false;
          if (types) {
            var arr = (typeof types.contains === 'function') ? types : { contains: function (t) { return Array.prototype.indexOf.call(types, t) !== -1; } };
            hasMove = arr.contains('text/calendar-event');
            hasResize = arr.contains('text/calendar-resize-end');
          }
          if (hasMove || hasResize) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.classList.add('drop-target');
          }
        } catch (_) { }
      });
      cell.addEventListener('dragleave', function () { this.classList.remove('drop-target'); });
      cell.addEventListener('drop', function (e) {
        e.preventDefault(); this.classList.remove('drop-target');
        try {
          var payload = e.dataTransfer.getData('text/calendar-event'); if (!payload) return;
          var obj = JSON.parse(payload); var fromDate = obj.fromDate; var id = obj.id; var toDate = this.dataset.date;
          if (!fromDate || !id || toDate === fromDate) return;
          var fromArr = Data.getEventsFor(fromDate); var idx = Ev.findIndexById(fromArr, id); if (idx === -1) return;
          var moved = fromArr.splice(idx, 1)[0]; Data.setEventsFor(fromDate, fromArr);
          renderAllCells(); var toArr = Data.getEventsFor(toDate); toArr.push(moved); Data.setEventsFor(toDate, toArr);
          withStableScroll(renderAllFn);
          var cFrom = cells.find(function (c) { return c.dataset.date === fromDate; }); if (cFrom) renderCell(cFrom);
          renderCell(this); renderTodayPanel();
          renderAllCells();
        } catch (err) { console.warn('drop failed', err); }
      });

      grid.appendChild(cell); cells.push(cell);
    }

    for (var day = 1; day <= dim; day++) {
      var d2 = new Date(state.year, state.month, day);
      var iso = Ev.toISODate(d2);
      var cell = document.createElement('div'); cell.className = 'cell'; cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-label', longHeaderFmt.format(d2)); cell.dataset.date = iso;

      var head = document.createElement('div'); head.className = 'cell-head';
      var hplus = document.createElement('div'); hplus.className = 'cell-head-plus'; hplus.textContent = String('+');
      var dn = document.createElement('div'); dn.className = 'day-num'; dn.textContent = String(day);
      head.appendChild(dn); head.appendChild(hplus); cell.appendChild(head);
      var list = document.createElement('div'); list.className = 'events'; cell.appendChild(list);

      var w = ((d2.getDay() + 6) % 7); if (w >= 5) cell.classList.add('weekend'); if (Ev.sameDate(d2, today)) cell.classList.add('today');

      cell.addEventListener('click', function (ev) {
        var openModalNew = global.CalendarApp.ui.openModalNew;
        var c = ev.currentTarget; var iso2 = c.dataset.date; var headEl = c.querySelector('.cell-head'); var listEl = c.querySelector('.events');
        if (ev.target === c || ev.target === headEl || ev.target === listEl || ev.target === headEl.firstChild) { openModalNew(iso2); }
      });

      cell.addEventListener('dragenter', function (e) { e.preventDefault(); this.classList.add('drop-target'); });
      cell.addEventListener('dragover', function (e) {
        try {
          var types = e.dataTransfer && e.dataTransfer.types;
          var hasMove = false, hasResize = false;
          if (types) {
            var arr = (typeof types.contains === 'function') ? { contains: function (t) { return types.contains(t); } } : { contains: function (t) { return Array.prototype.indexOf.call(types, t) !== -1; } };
            hasMove = arr.contains('text/calendar-event');
            hasResize = arr.contains('text/calendar-resize-end');
          }
          if (hasMove || hasResize) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // don't block other handlers on dragover; only stop on drop for resize
            cell.classList.add('drop-target');
          }
        } catch (_) { }
      });
      cell.addEventListener('dragleave', function () { this.classList.remove('drop-target'); });
      cell.addEventListener('drop', function (e) {
        e.preventDefault(); this.classList.remove('drop-target');
        try {
          var payload = e.dataTransfer.getData('text/calendar-event'); if (!payload) return;
          var obj = JSON.parse(payload); var fromDate = obj.fromDate; var id = obj.id; var toDate = this.dataset.date; if (!fromDate || !id || toDate === fromDate) return;
          var fromArr = Data.getEventsFor(fromDate); var idx = Ev.findIndexById(fromArr, id); if (idx === -1) return;
          var moved = fromArr.splice(idx, 1)[0]; Data.setEventsFor(fromDate, fromArr);
          renderAllCells(); var toArr = Data.getEventsFor(toDate); toArr.push(moved); Data.setEventsFor(toDate, toArr);
          withStableScroll(renderAllFn);
          var cFrom = cells.find(function (c) { return c.dataset.date === fromDate; }); if (cFrom) renderCell(cFrom);
          renderCell(this); renderTodayPanel();
          renderAllCells();
        } catch (err) { console.warn('drop failed', err); }
      });

      grid.appendChild(cell); cells.push(cell);
    }

    // Trailing next-month days up to Sunday (adjacent cells)
    (function () {
      var last = new Date(state.year, state.month, dim);
      var lastW = ((last.getDay() + 6) % 7);
      var trail = 6 - lastW; // 0..6 (Mon=0..Sun=6)
      for (var nd = 1; nd <= trail; nd++) {
        var d2 = new Date(state.year, state.month + 1, nd);
        var iso = Ev.toISODate(d2);

        var cell = document.createElement('div');
        cell.className = 'cell adjacent';
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', longHeaderFmt.format(d2));
        cell.dataset.date = iso;

        var head = document.createElement('div'); head.className = 'cell-head';
        var hplus = document.createElement('div'); hplus.className = 'cell-head-plus'; hplus.textContent = String('+');
        var dn = document.createElement('div'); dn.className = 'day-num'; dn.textContent = String(d2.getDate());
        head.appendChild(dn); head.appendChild(hplus); cell.appendChild(head);
        var list = document.createElement('div'); list.className = 'events'; cell.appendChild(list);

        var w = ((d2.getDay() + 6) % 7);
        if (w >= 5) cell.classList.add('weekend');
        if (Ev.sameDate(d2, today)) cell.classList.add('today');

        // UI + DnD listeners (same behavior as main cells)
        cell.addEventListener('click', function (ev) {
          var openModalNew = global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.openModalNew;
          if (!openModalNew) return;
          var c = ev.currentTarget; var iso2 = c.dataset.date;
          var headEl = c.querySelector('.cell-head'); var listEl = c.querySelector('.events');
          if (ev.target === c || ev.target === headEl || ev.target === listEl || ev.target === headEl.firstChild) { openModalNew(iso2); }
        });
        cell.addEventListener('dragenter', function (e) { e.preventDefault(); this.classList.add('drop-target'); });
        cell.addEventListener('dragover', function (e) {
          try {
            var types = e.dataTransfer && e.dataTransfer.types;
            var hasMove = false, hasResize = false;
            if (types) {
              var arr = (typeof types.contains === 'function') ? types : { contains: function (t) { return Array.prototype.indexOf.call(types, t) !== -1; } };
              hasMove = arr.contains('text/calendar-event');
              hasResize = arr.contains('text/calendar-resize-end');
            }
            if (hasMove || hasResize) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              this.classList.add('drop-target');
            }
          } catch (_) { }
        });
        cell.addEventListener('dragleave', function () { this.classList.remove('drop-target'); });
        cell.addEventListener('drop', function (e) {
          e.preventDefault(); this.classList.remove('drop-target');
          try {
            var payload = e.dataTransfer.getData('text/calendar-event'); if (!payload) return;
            var obj = JSON.parse(payload); var fromDate = obj.fromDate; var id = obj.id; var toDate = this.dataset.date;
            if (!fromDate || !id || toDate === fromDate) return;
            var fromArr = Data.getEventsFor(fromDate); var idx = Ev.findIndexById(fromArr, id); if (idx === -1) return;
            var moved = fromArr.splice(idx, 1)[0]; Data.setEventsFor(fromDate, fromArr);
            renderAllCells(); var toArr = Data.getEventsFor(toDate); toArr.push(moved); Data.setEventsFor(toDate, toArr);
            withStableScroll(renderAllFn);
            var cFrom = cells.find(function (c) { return c.dataset.date === fromDate; }); if (cFrom) renderCell(cFrom);
            renderCell(this); renderTodayPanel();
            renderAllCells();
          } catch (err) { console.warn('drop failed', err); }
        });

        grid.appendChild(cell); cells.push(cell);
      }
    })();
    withStableScroll(renderAllFn);
  }

  function renderAllCells() { for (var i = 0; i < cells.length; i++) { renderCell(cells[i]); } if (typeof enableResizeDnDOnCells === 'function') { enableResizeDnDOnCells(); } }

  // Enable resizing multi-day end via DnD payload 'text/calendar-resize-end'
  function enableResizeDnDOnCells() {
    for (var i = 0; i < cells.length; i++) {
      (function (cell) {
        if (!cell.__resizeEnabled) {
          cell.addEventListener('dragover', function (e) {
            try {
              if (e.dataTransfer && (e.dataTransfer.types || []).indexOf('text/calendar-resize-end') !== -1) {
                e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.stopImmediatePropagation(); cell.classList.add('drop-target');
              }
            } catch (_) { }
          });
          cell.addEventListener('dragleave', function () { cell.classList.remove('drop-target'); });
          cell.addEventListener('drop', function (e) {
            cell.classList.remove('drop-target');
            try {
              var payload = e.dataTransfer.getData('text/calendar-resize-end');
              if (!payload) return;
              e.preventDefault();
              e.stopImmediatePropagation(); var obj = JSON.parse(payload || '{}');
              var startDate = obj.startDate, id = obj.id;
              var toDate = cell.dataset.date;
              if (!startDate || !id || !toDate) return;
              var arr = Data.getEventsFor(startDate);
              var idx = Ev.findIndexById(arr, id);
              if (idx === -1) return;
              // set end_date = null if toDate == startDate, else toDate
              arr[idx].end_date = (toDate === startDate) ? null : toDate;
              Data.setEventsFor(startDate, arr);
              renderAllCells(); // re-render affected range (old/new)
              renderAllCells();
              renderTodayPanel();
            } catch (err) { console.warn('resize drop failed', err); }
          });
          cell.__resizeEnabled = true;
        }
      })(cells[i]);
    }
  }
  enableResizeDnDOnCells();

  function findCell(dateISO) { for (var i = 0; i < cells.length; i++) { if (cells[i].dataset.date === dateISO) return cells[i]; } return null; }


  // === Multi-day helpers ===
  function ymd(d) { return (d instanceof Date ? d.toISOString().slice(0, 10) : (d || '')).slice(0, 10); }
  function parseYMD(s) { var a = (s || '').split('-').map(Number); return new Date(a[0], (a[1] || 1) - 1, a[2] || 1); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function segmentForDay(day, startDay, endDay) {
    var d = ymd(day), a = ymd(startDay), b = ymd(endDay || startDay);
    if (b < a) { var t = a; a = b; b = t; }
    if (d < a || d > b) return null;
    if (a === b) return 'single';
    if (d === a) return 'start';
    if (d === b) return 'end';
    return 'mid';
  }
  function getEventsForDayExpanded(dateISO) {
    var base = (Data.getEventsFor ? Data.getEventsFor(dateISO) : []).slice();
    var out = base.map(function (ev) { var c = Object.assign({}, ev); c._seg = ev.end_date ? segmentForDay(dateISO, dateISO, ev.end_date) : 'single'; c._startDay = dateISO; return c; });
    if (typeof Data._getCache === 'function') {
      var cache = Data._getCache() || {};
      Object.keys(cache).forEach(function (day) {
        if (day === dateISO) return;
        var arr = cache[day] || [];
        for (var i = 0; i < arr.length; i++) {
          var ev = arr[i]; if (!ev || !ev.end_date) continue;
          var seg = segmentForDay(dateISO, day, ev.end_date);
          if (!seg) continue;
          var c = Object.assign({}, ev); c._seg = seg; c._startDay = day;
          out.push(c);
        }
      });
    }
    // sort: time asc (numeric), then urgent desc, then title
    out.sort(function (a, b) {
      function toM(t) { var p = String(t || '00:00').split(':'); var h = +p[0] || 0, m = +p[1] || 0; return h * 60 + m; }
      var am = toM(a.time), bm = toM(b.time);
      if (am !== bm) return am - bm;
      var u = (b.urgent | 0) - (a.urgent | 0); if (u) return u;
      return (a.title || '').localeCompare(b.title || '');
    });
    return out;
  }

  function renderCell(cell) {
    var dateISO = cell.dataset.date; var list = cell.querySelector('.events'); list.innerHTML = '';
    var events = getEventsForDayExpanded(dateISO);

    var matcher = Ev.buildMatcher(currentType, filterText ? filterText.value : '', { meId: __ME_ID });
    var filtered = events.filter(matcher);

    var openInfo = global.CalendarApp.ui.openInfo;
    var openModalEdit = global.CalendarApp.ui.openModalEdit;
    var openModalNew = global.CalendarApp.ui.openModalNew;

    for (var i = 0; i < filtered.length; i++) {
      var ev = filtered[i];
      var item = document.createElement('div'); item.className = 'event ' + Ev.typeToClass(ev.type) + (ev.urgent ? ' urgent' : ''); if (ev && ev.done) { try { item.classList.add('done'); } catch (_) { item.className += ' done'; } } item.setAttribute('draggable', (ev._seg && ev._seg === 'mid') ? 'false' : 'true'); item.setAttribute('data-id', ev.id);
      item.setAttribute('data-seg', (ev._seg || 'single'));
      item.setAttribute('data-start', (ev._startDay || dateISO));
      item.addEventListener('dragstart', function (e) {
        var d = e.currentTarget;
        var dt = e.dataTransfer; if (!dt) return;
        d.classList.add('dragging'); dt.effectAllowed = 'move';
        var seg = d.getAttribute('data-seg');
        var sday = d.getAttribute('data-start') || dateISO;
        var eid = d.getAttribute('data-id');
        if (seg === 'end') {
          dt.setData('text/calendar-resize-end', JSON.stringify({ startDate: sday, id: eid }));
        } else {
          // standard move from start/single
          dt.setData('text/calendar-event', JSON.stringify({ fromDate: sday, id: eid }));
        }
      });


      item.addEventListener('dragend', function (e) { e.currentTarget.classList.remove('dragging'); });


      var bar = document.createElement('div'); bar.className = 'bar';

      // -- compact content for multi-day segments: no extra badges/owner lines --
      var __isMultiSeg = !!(ev._seg && ev._seg !== 'single');

      var time = document.createElement('div'); time.className = 'event-time'; time.textContent = ev.time || '';
      var title = document.createElement('div'); title.className = 'event-title';

      if (ev.urgent) {
        var flag = document.createElement('span'); flag.className = 'flag-urgent';
        var icon = document.createElement('span'); icon.className = 'icon'; icon.innerHTML = '<svg class="icon"><use href="#i-fire-clock"></use></svg>';
        // '🔥';
        flag.appendChild(icon); item.appendChild(flag);
      }
      title.appendChild(document.createTextNode(ev.title || ''));

      var __showAssignedBadge = __isAssignedToMe(ev);
      var __showUserBadge = (!__showAssignedBadge && __isMyEvent(ev));

      // "My" marker (created by current user)
      if (__showUserBadge) {
        try { item.classList.add('has-user-badge'); } catch (_) { item.className += ' has-user-badge'; }
        var ub = document.createElement('span');
        ub.className = 'event-user-badge';
        ub.title = 'Моя подія';
        ub.innerHTML = '<svg aria-hidden="true"><use href="#i-user"></use></svg>';
        item.appendChild(ub);
      }

      // "Assigned to me / in progress" marker (responsible = current user, not done)
      if (__showAssignedBadge) {
        try { item.classList.add('has-assignee-badge'); } catch (_) { item.className += ' has-assignee-badge'; }
        var ab = document.createElement('span');
        ab.className = 'event-assignee-badge' + (__showUserBadge ? '' : ' is-solo');
        ab.title = 'На виконанні у мене';
        ab.innerHTML = ''
          + '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
          +   '<path d="M15.5 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="currentColor" opacity=".95"></path>'
          +   '<path d="M9.5 20.5c.5-2.8 2.8-4.8 5.9-4.8 3 0 5.2 1.8 5.8 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>'
          +   '<path d="M3.5 12.5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>'
          +   '<path d="M6.5 9.5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>'
          + '</svg>';
        item.appendChild(ab);
      }


      var del = document.createElement('button'); del.className = 'event-btn'; del.type = 'button'; del.setAttribute('aria-label', 'Видалити'); del.textContent = '×';
      var owner = document.createElement('div'); owner.className = 'event-owner'; owner.textContent = Ev.labelForType(ev.type) + (__ownerText(ev) ? (' • Відповідальний: ' + __ownerText(ev)) : '');

      del.addEventListener('click', function (e) {
        e.stopPropagation(); var eid = e.currentTarget.parentElement.getAttribute('data-id');
        var arr = Data.getEventsFor(dateISO); var idx = Ev.findIndexById(arr, eid); if (idx > -1) {
          arr.splice(idx, 1); Data.setEventsFor(dateISO, arr);
          withStableScroll(renderAllFn);
          renderCell(cell);
          withStableScroll(renderAllFn);
        }
      });

      item.addEventListener('click', function (e) {
        var openInfo = global.CalendarApp.ui.openInfo;
        e.stopPropagation(); var eid = this.getAttribute('data-id'); var seg = this.getAttribute('data-seg'); var sday = this.getAttribute('data-start') || dateISO;
        if (seg && seg !== 'single') {
          openInfo(sday, eid);
          // openModalEdit(sday, eid);
        }
        else {
          openInfo(dateISO, eid);
        }
      });

      item.appendChild(bar);
      item.appendChild(time);
      item.appendChild(title);

      // Позначка простроченого в клітинці
      try {
        if (isEventOverdueStrict(ev)) {
          item.classList.add('ev--overdue-flash');
        }
      } catch (_) { }

      if (ev._seg && ev._seg !== 'single') { item.classList.add('ev--multi'); }
      if (ev._seg) { item.className += ' ev--' + ev._seg; }      // item.appendChild(del);
      if (!__isMultiSeg) { item.appendChild(owner); }
      item.setAttribute('title', ev.title || '');
      list.appendChild(item);
    }
  }
  /* ===== Таймлайн «Сьогодні» ===== */
  ; (function () {
    try {
      var btnEarly = $('btnEarly');
      var btnLate = $('btnLate');

      if (typeof btnEarly !== 'undefined' && btnEarly) btnEarly.addEventListener('click', function () { earlyOpen = !earlyOpen; renderTodayPanel(); });
      if (typeof btnLate !== 'undefined' && btnLate) btnLate.addEventListener('click', function () { lateOpen = !lateOpen; renderTodayPanel(); });
    } catch (_) { /* no-op */ }
  })();

  function renderTodayPanel() {
    var earlyTimeline = $('earlyTimeline');
    var todayTimeline = $('todayTimeline');
    var lateTimeline = $('lateTimeline');

    if (!todayTimeline) return;
    try {
      earlyTimeline.innerHTML = '';
      todayTimeline.innerHTML = '';
      lateTimeline.innerHTML = '';
    } catch (_) { return; }

    hourHoverCount = {}; quarterHas = {};

    // Re-evaluate "today" on each render (keeps /today correct after midnight)
    var now = new Date();
    today = now;
    try { if (todayPanelDate) todayPanelDate.textContent = longHeaderFmt.format(now).replace('.', ''); } catch (_) { }

    var todayISO = Ev.toISODate(now);
    var nextISO = Ev.toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

    var matcher = Ev.buildMatcher(currentType, filterText ? filterText.value : '', { meId: __ME_ID });
    var allToday = getEventsForDayExpanded(todayISO)
      .filter(matcher)
      .sort(function (a, b) { function toM(t) { var p = String(t || '00:00').split(':'); var h = +p[0] || 0, m = +p[1] || 0; return h * 60 + m; } var am = toM(a.time), bm = toM(b.time); if (am !== bm) return am - bm; var u = (b.urgent | 0) - (a.urgent | 0); if (u) return u; return (a.title || '').localeCompare(b.title || ''); });
    var allNext = getEventsForDayExpanded(nextISO)
      .filter(matcher)
      .sort(function (a, b) { function toM(t) { var p = String(t || '00:00').split(':'); var h = +p[0] || 0, m = +p[1] || 0; return h * 60 + m; } var am = toM(a.time), bm = toM(b.time); if (am !== bm) return am - bm; var u = (b.urgent | 0) - (a.urgent | 0); if (u) return u; return (a.title || '').localeCompare(b.title || ''); });

    quarterHas[todayISO] = {}; quarterHas[nextISO] = {};

    for (var i1 = 0; i1 < allToday.length; i1++) {
      var p = (allToday[i1].time || '00:00').split(':'), hh = +p[0] || 0, mm = +p[1] || 0;
      if (mm !== 0) quarterHas[todayISO][hh] = true;
    }
    for (var j1 = 0; j1 < allNext.length; j1++) {
      var q = (allNext[j1].time || '00:00').split(':'), h2 = +q[0] || 0, m2 = +q[1] || 0;
      if (m2 !== 0) quarterHas[nextISO][h2] = true;
    }

    var earlyCount = allToday.filter(function (e) { var h = (+((e.time || '00:00').split(':')[0]) || 0); return h < 6; }).length;
    var lateCount = allNext.filter(function (e) { var h = (+((e.time || '00:00').split(':')[0]) || 0); return h < 6; }).length;
    var earlyCountEl = $('earlyCount'), lateCountEl = $('lateCount');
    if (earlyCountEl) earlyCountEl.textContent = earlyCount ? ('подій: ' + earlyCount) : '';
    if (lateCountEl) lateCountEl.textContent = lateCount ? ('подій: ' + lateCount) : '';

    var earlyWrap = $('earlyWrap');
    var lateWrap = $('lateWrap');
    if (earlyWrap) earlyWrap.classList.toggle('open', !!earlyOpen);
    if (lateWrap) lateWrap.classList.toggle('open', !!lateOpen);

    function buildByQuarter(list) {
      var map = {};
      for (var h = 0; h < 24; h++) {
        for (var m = 0; m < 60; m += 15) {
          map[Ev.pad2(h) + ':' + Ev.pad2(m)] = [];
        }
      }
      for (var k = 0; k < list.length; k++) {
        var ev = list[k];
        var parts = (ev.time || '00:00').split(':'), H = +parts[0] || 0, M = +parts[1] || 0;
        var key = Ev.pad2(H) + ':' + Ev.pad2(Math.floor(M / 15) * 15);
        map[key].push(ev);
      }
      return map;
    }

    var byQToday = buildByQuarter(allToday);
    var byQNext = buildByQuarter(allNext);



    // Restore interactive hour expand/collapse during DnD for Today panel
    function expandHour(dateISO, hour) {
      ['15', '30', '45'].forEach(function (min) {
        var elq = document.querySelector('.slot.quarter[data-date="' + dateISO + '"][data-hour="' + hour + '"][data-min="' + min + '"]');
        if (elq) elq.style.display = 'grid';
      });
    }
    function collapseHour(dateISO, hour) {
      // keep open if the hour has quarter events
      if (quarterHas[dateISO] && quarterHas[dateISO][hour]) return;
      ['15', '30', '45'].forEach(function (min) {
        var elq = document.querySelector('.slot.quarter[data-date="' + dateISO + '"][data-hour="' + hour + '"][data-min="' + min + '"]');
        if (elq) elq.style.display = 'none';
      });
    }

    function renderGroup(tl, dateISO, startHour, endHour) {
      var openInfo = global.CalendarApp.ui.openInfo;

      if (!tl) return;
      for (var h = startHour; h < endHour; h++) {
        for (var m = 0; m < 60; m += 15) {
          var slot = document.createElement('div');
          slot.className = 'slot quarter';
          slot.dataset.date = dateISO;
          slot.dataset.hour = String(h);
          slot.dataset.min = String(m);

          slot.addEventListener('dragenter', function (e) {
            e.preventDefault(); this.classList.add('drop-target');
            var HH = parseInt(this.dataset.hour, 10) || 0; var key = this.dataset.date + '|' + HH;
            hourHoverCount[key] = (hourHoverCount[key] || 0) + 1; if (this.dataset.min === '0') { expandHour(this.dataset.date, HH); }
          });
          slot.addEventListener('dragover', function (e) {
            e.preventDefault(); this.classList.add('drop-target'); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          });
          slot.addEventListener('dragleave', function () {
            this.classList.remove('drop-target');
            var HH = parseInt(this.dataset.hour, 10) || 0; var key = this.dataset.date + '|' + HH;
            hourHoverCount[key] = Math.max((hourHoverCount[key] || 1) - 1, 0); var date = this.dataset.date; setTimeout(function () { if (hourHoverCount[key] === 0 && !(quarterHas[date] && quarterHas[date][HH])) { collapseHour(date, HH); } }, 60);
          });
          slot.addEventListener('drop', function (e) {
            e.preventDefault(); this.classList.remove('drop-target'); var HH = parseInt(this.dataset.hour, 10) || 0; var key = this.dataset.date + '|' + HH; hourHoverCount[key] = Math.max((hourHoverCount[key] || 1) - 1, 0); var __date = this.dataset.date; setTimeout(function () { if (hourHoverCount[key] === 0 && !(quarterHas[__date] && quarterHas[__date][HH])) { collapseHour(__date, HH); } }, 60);
            try {
              var payload = e.dataTransfer && e.dataTransfer.getData('text/calendar-event'); if (!payload) return;
              var obj = JSON.parse(payload); var fromDate = obj.fromDate; var id = obj.id;
              var nh = parseInt(this.dataset.hour, 10) || 0; var nm = parseInt(this.dataset.min, 10) || 0; var newTime = Ev.pad2(nh) + ':' + Ev.pad2(nm);
              var targetDate = this.dataset.date;
              if (fromDate && fromDate !== targetDate) {
                var fromArr = Data.getEventsFor(fromDate); var idx = Ev.findIndexById(fromArr, id); if (idx === -1) return;
                var moved = fromArr.splice(idx, 1)[0]; moved.time = newTime; Data.setEventsFor(fromDate, fromArr);
                renderAllCells(); var toArr = Data.getEventsFor(targetDate); toArr.push(moved); Data.setEventsFor(targetDate, toArr);
                withStableScroll(renderAllFn);
                var cFrom = findCell(fromDate); if (cFrom) renderCell(cFrom);
              } else {
                var arr = Data.getEventsFor(targetDate);
                arr = global.CalendarApp.events.updateEventTimeInArray(arr, id, newTime);
                Data.setEventsFor(targetDate, arr);
                renderAllCells();
              }
              var c1 = findCell(targetDate); if (c1) renderCell(c1);
              renderTodayPanel();
            } catch (err) { console.warn('drop quarter', err); }
          });

          var time = document.createElement('div'); time.className = 'time'; time.textContent = (m === 0 ? (Ev.pad2(h) + ':00') : (':' + Ev.pad2(m))); if (m !== 0) time.classList.add('qmin');
          var items = document.createElement('div'); items.className = 'items';

          var key = Ev.pad2(h) + ':' + Ev.pad2(m);
          var arr = (dateISO === todayISO ? byQToday[key] : byQNext[key]) || [];
          for (var r = 0; r < arr.length; r++) {
            var ev = arr[r];
            var row = document.createElement('div');
            row.className = 'item' + (ev.urgent ? ' urgent' : '') + (ev && ev.done ? ' done' : '');
            var seg = (ev && ev._seg) ? ev._seg : 'single';
            var sday = (ev && ev._startDay) ? ev._startDay : dateISO;
            row.dataset.date = sday;
            row.dataset.id = ev.id;
            row.dataset.start = sday;
            row.dataset.seg = seg;
            row.setAttribute('draggable', 'true');
            if (seg !== 'single') row.classList.add('ev--multi');
            row.classList.add('ev--' + seg);

            try {
              if (isEventOverdueStrict(ev)) {
                row.classList.add('ev--overdue-flash');
              }
            } catch (_) { }
            row.addEventListener('dragstart', function (e) {
              var id = e.currentTarget.dataset.id; var d = e.currentTarget.dataset.date;
              if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/calendar-event', JSON.stringify({ fromDate: d, id: id })); }
            });
            if (ev.urgent) {
              var flag = document.createElement('span'); flag.className = 'flag-urgent';
              var icon = document.createElement('span'); icon.className = 'icon'; icon.innerHTML = '<svg class="icon"><use href="#i-fire-clock"></use></svg>';
              flag.appendChild(icon); row.appendChild(flag);
            }
            var dot = document.createElement('span'); dot.className = 'dot ' + (ev.type || 'evt'); row.appendChild(dot);
            var label = (ev.time || '') + ' — ' + ev.title + (__ownerText(ev) ? (' • ' + __ownerText(ev)) : '');
            row.appendChild(document.createTextNode(label));
            row.addEventListener('click', function () {
              // В Today-панелі відкриваємо Info
              var did = this.dataset.id; var sday = this.dataset.start || this.dataset.date || dateISO; openInfo(sday, did);
            });
            items.appendChild(row);
          }

          if (m !== 0) {
            var keep = quarterHas[dateISO] && quarterHas[dateISO][h];
            slot.style.display = keep ? 'grid' : 'none';
          }
          slot.appendChild(time);
          slot.appendChild(items);
          tl.appendChild(slot);
        }
      }
    }

    if (earlyOpen) renderGroup(earlyTimeline, todayISO, 0, 6);
    renderGroup(todayTimeline, todayISO, 6, 24);
    if (lateOpen) renderGroup(lateTimeline, nextISO, 0, 6);
  }


  /* ===== Ініціалізація ===== */
  function migrateEnsureIds() {
    var s = Data.readStore();
    var changed = false;
    for (var k in s) {
      if (Object.prototype.hasOwnProperty.call(s, k)) {
        var res = Ev.migrateArray(s[k]);
        s[k] = res.list; changed = changed || res.changed;
      }
    }
    if (changed) Data.writeStore(s);
  }

  function openTodayPopupWindow() {
    try {
      var url = '/today/';

      // Dimensions: ~35% of screen width, up to 560px; height up to 900px
      var sw = (window.screen && window.screen.availWidth) ? window.screen.availWidth : 1200;
      var sh = (window.screen && window.screen.availHeight) ? window.screen.availHeight : 800;

      var w = Math.max(360, Math.min(560, Math.floor(sw * 0.36)));
      var h = Math.max(520, Math.min(900, Math.floor(sh * 0.92)));

      var left = Math.max(0, Math.floor((sw - w) / 2));
      var top  = Math.max(0, Math.floor((sh - h) / 2));

      var features = [
        'popup=yes',
        'toolbar=no',
        'location=no',
        'directories=no',
        'status=no',
        'menubar=no',
        'scrollbars=yes',
        'resizable=yes',
        'width=' + w,
        'height=' + h,
        'left=' + left,
        'top=' + top
      ].join(',');

      var win = window.open(url, 'calendarToday', features);

      if (!win) {
        alert('Браузер заблокував спливаюче вікно. Дозвольте pop-up для цього сайту.');
        return;
      }

      try { win.opener = null; } catch (_) { }
      try { win.focus(); } catch (_) { }
    } catch (_) { }
  }

  function wireTodayPopupOpenButton() {
    var btn = document.getElementById('btnOpenTodayWindow');
    if (!btn || btn.__wired) return;
    btn.__wired = true;

    btn.addEventListener('click', function (e) {
      try { e.preventDefault(); } catch (_) { }
      openTodayPopupWindow();
    });
  }

  function calendar_init() {
    if (__TODAY_ONLY) {
      return today_only_init();
    }

    // Рендер каркасу
    renderCalendar();
    wireTodayPopupOpenButton();
    // Завантаження й первинний рендер
    Data.serverLoadStore().then(function (data) {
      Data._setCache(Data.ensureStoreShape(data));
      migrateEnsureIds();
      withStableScroll(renderAllFn);
      try { __applyPendingCalendarScrollRestore(); } catch (_) { }
    });
  }

  // /today — only Today panel (data load + timeline render)
  function today_only_init() {
    return Data.serverLoadStore().then(function (data) {
      Data._setCache(Data.ensureStoreShape(data));
      migrateEnsureIds();
      try {
        if (typeof withStableScroll === 'function') withStableScroll(renderAllFn);
        else renderAllFn();
      } catch (_) { }
    });
  }

  // встановлюємо обробку змін
  setInterval(() => {
    calendar_init();
  }, 60_000);

  // Експорт UI API (якщо буде потрібно з інших скриптів)
  global.CalendarApp = global.CalendarApp || {};
  global.CalendarApp.ui = global.CalendarApp.ui || {};
  // global.CalendarApp.ui.init = init;
  global.CalendarApp.ui.renderAllFn = renderAllFn;
  global.CalendarApp.ui.getCurrentMonthContext = function () { return { year: state.year, month: state.month + 1, monthIndex: state.month }; };
  CalendarApp.ui.isEventOverdueStrict = isEventOverdueStrict;
  window.CalendarApp.ui.isEventClosed = isEventClosed;
  window.CalendarApp.ui.applyClosedStyles = applyClosedStyles;
  window.CalendarApp.ui.migrateEnsureCloseFields = migrateEnsureCloseFields;
  window.CalendarApp.ui.closeEventById = closeEventById;
  window.CalendarApp.ui.reopenEventById = reopenEventById;

  // Автостарт
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', calendar_init);
  } else {
    calendar_init();
  }

})(window);
