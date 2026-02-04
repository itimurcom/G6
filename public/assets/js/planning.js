// planning.js
(function (global) {
  "use strict";
  // === Multi-day segment helpers (declarations) ===
  function _segPosition(dk, startDay, endDay) {
    if (!endDay || !startDay) return "single";
    var s = String(startDay).slice(0, 10), e = String(endDay).slice(0, 10), d = String(dk).slice(0, 10);
    if (e < s) { var t = s; s = e; e = t; }
    if (d < s || d > e) return "single";
    if (s === e) return "single";
    if (d === s) return "start";
    if (d === e) return "end";
    return "mid";
  }

  global.CalendarApp = global.CalendarApp || {};
  global.CalendarApp.ui = global.CalendarApp.ui || {};
  global.CalendarApp.ui.renderAllFn = refreshPlanning;

  var Data = (global.CalendarApp && global.CalendarApp.data) || {};

  // ---------- Robust event day resolution ----------
  // openInfo/openModalEdit require the *store day key* where the event lives.
  // Some Planning items may carry a logical start_date that differs from the store key,
  // so we resolve (id -> dayKey) before opening.
  var __ID_DAY_CACHE = Object.create(null);

  function resolveEventDayById(id, preferredDay) {
    id = (id == null) ? "" : String(id);
    if (!id) return preferredDay ? String(preferredDay).slice(0, 10) : null;

    var cached = __ID_DAY_CACHE[id];
    if (cached) return cached;

    var day = preferredDay ? String(preferredDay).slice(0, 10) : "";
    // 1) fast path: preferred day already contains the id
    try {
      if (day && typeof Data.getEventsFor === "function") {
        var a0 = Data.getEventsFor(day) || [];
        for (var i0 = 0; i0 < a0.length; i0++) {
          var e0 = a0[i0];
          if (e0 && String(e0.id) === id) { __ID_DAY_CACHE[id] = day; return day; }
        }
      }
    } catch (_) { }

    // 2) slow path: scan cache/store
    try {
      var cache = (typeof Data._getCache === "function" ? (Data._getCache() || {}) : (global.CalendarApp && global.CalendarApp.data && global.CalendarApp.data._cache) || {}) || {};
      var keys = Object.keys(cache);
      for (var k = 0; k < keys.length; k++) {
        var dk = String(keys[k]).slice(0, 10);
        if (!dk) continue;
        var arr = (typeof Data.getEventsFor === "function") ? (Data.getEventsFor(dk) || []) : (cache[dk] || cache[keys[k]] || []);
        for (var j = 0; j < arr.length; j++) {
          var ev = arr[j];
          if (ev && String(ev.id) === id) { __ID_DAY_CACHE[id] = dk; return dk; }
        }
      }
    } catch (_) { }

    return day || null;
  }

  var Ev = (global.CalendarApp && global.CalendarApp.events) || {};


  // ---------- wait for Calendar UI (exported by loader bundle) ----------
  function waitForCalendarUI() {
    return new Promise(function (resolve) {
      function ready() {
        return (
          global.CalendarApp &&
          CalendarApp.ui &&
          typeof CalendarApp.ui.openInfo === "function" &&
          typeof CalendarApp.ui.openModalEdit === "function"
        );
      }

      if (ready()) return resolve(CalendarApp.ui);

      function onReady() {
        if (ready()) {
          global.removeEventListener("calendar:ui-ready", onReady);
          resolve(CalendarApp.ui);
        }
      }

      global.addEventListener("calendar:ui-ready", onReady);

      var id = setInterval(function () {
        if (ready()) {
          clearInterval(id);
          resolve(CalendarApp.ui);
        }
      }, 80);

      setTimeout(function () {
        clearInterval(id);
        if (ready()) resolve(CalendarApp.ui);
      }, 8000);
    });
  }

  function tryOpenInfo(dateISO, id) {
    var ui = global.CalendarApp && CalendarApp.ui;
    if (ui && typeof ui.openInfo === "function") return ui.openInfo(dateISO, id);
    console.warn("[plan-today] openInfo not available yet");
    waitForCalendarUI().then(function (ui) {
      ui.openInfo(dateISO, id);
    });
  }

  function tryOpenEdit(dateISO, id) {
    var ui = global.CalendarApp && CalendarApp.ui;
    if (ui && typeof ui.openModalEdit === "function") return ui.openModalEdit(dateISO, id);
    waitForCalendarUI().then(function (ui) {
      ui.openModalEdit(dateISO, id);
    });
  }

  // ---------- Data access ----------
  var Data = (global.CalendarApp && global.CalendarApp.data) || {};
  var MOUNT_ID = "planning-today";
  var TOOLBAR_ID = "planning-toolbar";
  var STATE = { scope: (localStorage.getItem("planning.scope") || "all"), userId: 0 };
  function readCurrentUserId() {
    try {
      var m = document.getElementById(MOUNT_ID);
      var id = m && m.dataset ? parseInt(m.dataset.userId || "0", 10) : 0;
      return isNaN(id) ? 0 : id;
    } catch (_) { return 0; }
  }
  function ensureToolbar() {
    var t = document.getElementById(TOOLBAR_ID);
    if (!t) return;
    var inputs = t.querySelectorAll("input[name=planning-scope]");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].checked = (inputs[i].value === STATE.scope);
      inputs[i].addEventListener("change", function (ev) {
        STATE.scope = ev.target.value === "my" ? "my" : "all";
        localStorage.setItem("planning.scope", STATE.scope);
        ensureStore(render);
      });
    }
  }
  function applyScope(list) {
    if (STATE.scope !== "my") return list;
    var uid = STATE.userId || 0; if (!uid) return [];
    var out = []; for (var i = 0; i < list.length; i++) { var it = list[i] || {}; var ev = it.ev || {}; var u = parseInt(ev.user_id || 0, 10); if (u === uid) out.push(it); }
    return out;
  }


  // ---------- store helpers ----------
  function ensureStore(cb) {
    try {
      var store =
        typeof Data._getCache === "function" ? Data._getCache() : Data.dayMap || null;

      if (store && typeof store === "object" && Object.keys(store).length) {
        cb(store);
        return;
      }

      if (Data && typeof Data.serverLoadStore === "function") {
        Data.serverLoadStore()
          .then(function (resp) {
            var shaped =
              typeof Data.ensureStoreShape === "function"
                ? Data.ensureStoreShape(resp)
                : resp || {};
            if (typeof Data._setCache === "function") Data._setCache(shaped);
            cb(shaped || {});
          })
          .catch(function () {
            cb({});
          });
        return;
      }
    } catch (e) {
      /* ignore */
    }
    cb({});
  }

  function collectForDay(store, dk) {
    // Robust multi-day inclusion + separate display time
    var out = [];
    var base = (Data.getEventsFor ? (Data.getEventsFor(dk) || []) : (store[dk] || [])).slice();

    // base-day items
    for (var i = 0; i < base.length; i++) {
      var ev = base[i] || {};
      var t = ev.time || ev.start || "00:00";
      var dt = toDate(dk, t);
      out.push({
        start: dt,          // sort by actual time on start day
        display: dt,        // display the same time
        ev: ev, dk: dk,
        startDay: dk,
        endDay: (ev.end_date || ev.end || dk)
      });
    }

    // cross-day segments (mid/end)
    (function includeSpans() {
      var cache = {};
      if (typeof Data._getCache === "function") cache = Data._getCache() || {};
      else cache = store || {};

      var keys = Object.keys(cache);
      for (var idx = 0; idx < keys.length; idx++) {
        var day = keys[idx];
        if (day === dk) continue;
        var list = cache[day] || [];
        for (var j = 0; j < list.length; j++) {
          var ev2 = list[j] || {};
          var endDay = ev2.end_date || ev2.end;
          if (!endDay) continue;

          // inside [start..end] ?
          var a = String(day).slice(0, 10), b = String(endDay).slice(0, 10), d = String(dk).slice(0, 10);
          var s = a, e = b; if (e < s) { var tmp = s; s = e; e = tmp; }
          if (d < s || d > e) continue;

          // Sorting key -> 00:00 (keep segments at top), DISPLAY -> original start time
          var sortAt = toDate(dk, "00:00");
          var dispAt = toDate(dk, ev2.time || ev2.start || "00:00");

          out.push({
            start: sortAt,
            display: dispAt,
            ev: ev2, dk: dk,
            startDay: day,
            endDay: endDay
          });
        }
      }
    })();

    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }

  // ---------- overdue collection (past keys outside window) ----------
  function __uaDayShortFromKey(dk) {
    dk = String(dk || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dk)) return dk.slice(8, 10) + "." + dk.slice(5, 7);
    return dk;
  }

  function __uaDayFullFromKey(dk) {
    dk = String(dk || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dk)) return dk.slice(8, 10) + "." + dk.slice(5, 7) + "." + dk.slice(0, 4);
    return dk;
  }

  function collectOverdue(store, cutoffExclusiveDayKey) {
    // Collect overdue events with start day strictly before cutoffExclusiveDayKey (e.g., before "Вчора")
    // Dedupe by event.id, keep most recent instance.
    var out = [];
    var seen = Object.create(null);
    var keys = Object.keys(store || {}).sort(); // YYYY-MM-DD sortable
    for (var i = 0; i < keys.length; i++) {
      var dk = String(keys[i]).slice(0, 10);
      if (!dk) continue;
      if (cutoffExclusiveDayKey && dk >= String(cutoffExclusiveDayKey).slice(0, 10)) break;

      var list = (Data.getEventsFor ? (Data.getEventsFor(dk) || []) : (store[dk] || []));
      for (var j = 0; j < list.length; j++) {
        var ev = list[j] || {};
        if (!ev) continue;

        // Determine "start day" for display/dedupe
        var startDay = String((ev.start_date || ev.date || ev._date || dk) || "").slice(0, 10) || dk;

        // Strict overdue check (shared helper from app.js)
        if (!isEventOverdueStrict(ev)) continue;

        var eid = (ev.id && String(ev.id).trim()) ? String(ev.id) : ensureEventId(startDay, ev);
        if (!eid) continue;

        // keep only one item per id
        if (seen[eid]) continue;
        seen[eid] = 1;

        var t = ev.time || ev.start || "00:00";
        var dt = toDate(startDay, t);

        out.push({
          start: dt,
          display: dt,
          ev: ev,
          dk: startDay,
          startDay: startDay,
          endDay: (ev.end_date || ev.end || startDay),
          dateLabel: __uaDayShortFromKey(startDay),
          dateTitle: __uaDayFullFromKey(startDay)
        });
      }
    }

    // Most recent overdue first
    out.sort(function (a, b) { return b.start - a.start; });
    return out;
  }



  (function ensurePlanningSegCss() {
    var id = "planning-seg-css";
    if (document.getElementById(id)) return;
    var css = [
      ,
      ,
      ,
      ,
      ".seg-li-start{background:rgba(34,197,94,.08)}",
      ".seg-li-mid{background:rgba(234,179,8,.06)}",
      ".seg-li-end{background:rgba(239,68,68,.06)}",

    ].join("\\n");
    var el = document.createElement("style"); el.id = id; el.textContent = css; document.head.appendChild(el);
  })();


  // ---------- type helpers (use existing globals; fallback) ----------
  var _typeToClass =
    typeof global.typeToClass === "function"
      ? global.typeToClass
      : function (t) {
        return t === "mi"
          ? "type-mi"
          : t === "nas"
            ? "type-nas"
            : t === "evt"
              ? "type-evt"
              : "type-other";
      };

  var _labelForType =
    typeof global.labelForType === "function"
      ? global.labelForType
      : function (t) {
        return t === "mi"
          ? "ТЛГ: МИ"
          : t === "nas"
            ? "ТЛГ: НАС"
            : t === "evt"
              ? "Захід"
              : "Інше";
      };

  // ---------- ensure stable id & persist ----------
  function ensureEventId(dateISO, ev) {
    if (!ev) return "";
    if (ev.id && String(ev.id).trim()) return String(ev.id);

    var newId =
      global.Ev && typeof global.Ev.genId === "function"
        ? global.Ev.genId()
        : "e_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    ev.id = newId;

    try {
      if (typeof Data.getEventsFor === "function" && typeof Data.setEventsFor === "function") {
        var arr = Data.getEventsFor(dateISO) || [];
        var idx = arr.indexOf(ev);
        if (idx > -1) {
          arr[idx] = ev;
        } else {
          arr.push(ev);
        }
        Data.setEventsFor(dateISO, arr);
      }
    } catch (_e) {
      /* noop */
    }

    return newId;
  }

  // ---------- section builder ----------
  function section(label, dateValue, items) {
    var wrap = document.createElement("div");
    wrap.className = "planning-section";

    var h = document.createElement("div");
    h.className = "planning-section__title";

    var labelEl = document.createElement("span");
    labelEl.textContent = label + " ";

    var dateEl = document.createElement("span");
    dateEl.className = "planning-section__date";
    dateEl.textContent = toUADisplayDate(dateValue);

    h.appendChild(labelEl);
    h.appendChild(dateEl);
    wrap.appendChild(h);

    if (!items.length) {
      var empty = document.createElement("div");
      empty.className = "planning-empty";
      empty.textContent = "Список пуст";
      wrap.appendChild(empty);
      return wrap;
    }

    var ul = document.createElement("ul");
    ul.className = "planning-today__list";

    for (var i = 0; i < items.length; i++) {
      let it = items[i];
      // determine segment position (requires helpers from v5)
      var segPos = _segPosition(it.dk, (it.startDay || it.dk), (it.endDay || (it.ev && it.ev.end_date) || null));
      // date to use for opening info/edit (original start day for segments)
      var infoDate = (segPos === "single") ? it.dk : (it.startDay || it.dk);

      // Capture per-item constants to avoid closure over 'var'
      let dk = it.dk;
      let ev = it.ev;
      let eid = (ev && ev.id && String(ev.id).trim()) ? String(ev.id) : ensureEventId((it.startDay || dk), ev);

      var li = document.createElement("li");
      li.className = "planning-today__item";

      if (ev.urgent) li.classList.add("urgent");
      if (ev.done) li.classList.add("done");
      li.setAttribute("data-date", dk);

      // === Added: expose meta for filters ===
      try {
        li.setAttribute("data-type", (String(ev.type || "other").toLowerCase() || "other"));
        li.setAttribute("data-owner", (ev.owner ? String(ev.owner) : ""));
        li.setAttribute("data-done", (ev.done ? "1" : "0"));
        li.setAttribute("data-urgent", (ev.urgent ? "1" : "0"));
        // event start date (best effort): prefer explicit ev.date -> startDay -> dk
        var evStartDay = (ev.date || it.startDay || dk) ? String((ev.date || it.startDay || dk)).slice(0, 10) : "";
        li.setAttribute("data-ev-date", evStartDay);
        // end date if present
        var evEndDay = (it.endDay || ev.end_date || ev.end || "");
        li.setAttribute("data-ev-end-date", evEndDay ? String(evEndDay).slice(0, 10) : "");
        // times if present
        var evStartTime = (ev.time || ev.start || "");
        if (evStartTime) li.setAttribute("data-ev-start", String(evStartTime).slice(0, 5));
        var evEndTime = (ev.end_time || ev.endTime || "");
        if (evEndTime) li.setAttribute("data-ev-end", String(evEndTime).slice(0, 5));
      } catch (e) { /* safe */ }
      // === /Added ===

      var time = document.createElement("div");
      time.className = "planning-today__time";
      var __t = formatTime(it.display || it.start);
      if (it.dateLabel) __t = String(it.dateLabel) + " " + __t;
      time.textContent = __t;
      if (it.dateTitle) time.title = String(it.dateTitle);

      var details = document.createElement("div");
      details.className = "planning-today__details";

      // chip (left) + title (right)
      var tRaw = String(ev.type || "").toLowerCase();

      var chip = document.createElement("span");
      chip.className = "chip " + _typeToClass(tRaw);
      if (isEventOverdueStrict(ev)) chip.classList.add('ev--overdue-flash');
      if (ev.urgent) chip.classList.add('urgent');

      chip.textContent = _labelForType(tRaw);
      chip.id = eid;
      // v11: segment classes on CHIP (not the row)
      chip.setAttribute("data-seg", segPos);
      if (segPos !== "single") {
        chip.classList.add("ev--multi");
        chip.classList.add("ev--" + (segPos === "mid" ? "mid" : segPos));
      }

      chip.setAttribute("data-date", infoDate);
      chip.setAttribute("data-id", eid);
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");

      // NOTE: keeping original listeners as-is (project compatibility)
      chip.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey) { openEdit(); } else { openInfo(); }
      });
      chip.addEventListener("dblclick", function (e) {
        e.preventDefault(); e.stopPropagation(); openEdit();
      });
      chip.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openInfo(); }
        if (e.key.toLowerCase() === "e" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openEdit(); }
      });
      chip.addEventListener("contextmenu", function (e) {
        e.preventDefault(); e.stopPropagation(); openInfo();
      });

      // (v10) seg-badge removed: styling handled via .ev-- classes
      chip.title = "Тип: " + chip.textContent;
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");

      var titleEl = document.createElement("div");
      titleEl.className = "planning-today__title";
      titleEl.textContent = ev.title || "";
      titleEl.setAttribute("role", "button");
      titleEl.setAttribute("tabindex", "0");

      var owner = document.createElement("div");
      owner.className = "planning-today__owner";
      owner.textContent = ev.owner ? String(ev.owner) : "";

      li.setAttribute("data-type", tRaw || "other");

      details.appendChild(chip);
      details.appendChild(titleEl);
      if (owner.textContent) details.appendChild(owner);

      li.appendChild(time);
      li.appendChild(details);
      ul.appendChild(li);

      // Additional direct open (stable, uses captured infoDate/eid)
      chip.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        let eid2 = e.currentTarget.getAttribute("id");
        var d2 = resolveEventDayById(eid2, infoDate) || infoDate;
        tryOpenInfo(d2, eid2);
      });
    }

    wrap.appendChild(ul);
    return wrap;
  }

  // Overdue section: group items by start day (date headers aligned with section dates)
  function sectionOverdueGrouped(label, cutoffDateValue, items) {
    var wrap = document.createElement("div");
    wrap.className = "planning-section";

    var h = document.createElement("div");
    h.className = "planning-section__title";

    var labelEl = document.createElement("span");
    labelEl.textContent = label + " ";

    var dateEl = document.createElement("span");
    dateEl.className = "planning-section__date";
    dateEl.textContent = toUADisplayDate(cutoffDateValue);

    h.appendChild(labelEl);
    h.appendChild(dateEl);
    wrap.appendChild(h);

    if (!items || !items.length) {
      var empty = document.createElement("div");
      empty.className = "planning-empty";
      empty.textContent = "Список пуст";
      wrap.appendChild(empty);
      return wrap;
    }

    // Group by start day key (YYYY-MM-DD)
    var buckets = Object.create(null);
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {};
      var dk = String((it.startDay || it.dk || (it.ev && (it.ev.start_date || it.ev.date || it.ev._date)) || "")).slice(0, 10);
      if (!dk) continue;
      if (!buckets[dk]) buckets[dk] = [];
      buckets[dk].push(it);
    }

    var days = Object.keys(buckets).sort().reverse(); // most recent overdue first
    for (var di = 0; di < days.length; di++) {
      var dayKey = days[di];
      var list = buckets[dayKey] || [];
      // Sort inside the day by time ascending
      list.sort(function (a, b) { return (a.start || 0) - (b.start || 0); });

      // Reuse section() renderer for consistent item markup.
      // Label uses the longest day name to keep date aligned; label itself is hidden via CSS.
      var tmp = section("Післязавтра", parseDayKey(dayKey), list);
      var th = tmp.querySelector(".planning-section__title");
      if (th) th.classList.add("planning-overdue__dayTitle");
      // Hide the label text (it is only used as a spacer for alignment)
      // Do NOT rely on CSS for this: keep it self-contained in JS.
      try {
        var __labelSpan = th ? th.querySelector("span") : null;
        if (__labelSpan) {
          __labelSpan.textContent = "Післязавтра ";
          __labelSpan.style.visibility = "hidden";
          __labelSpan.style.userSelect = "none";
        }
      } catch (e) { }
      var ul = tmp.querySelector(".planning-today__list");

      if (th) wrap.appendChild(th);
      if (ul) wrap.appendChild(ul);
    }

    return wrap;
  }



  // ---------- page render ----------
  function render(store) {
    STATE.userId = readCurrentUserId();
    ensureToolbar();
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;

    var now = new Date();
    var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    var dkY = keyFromDateLocal(
      new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1)
    );
    var dkT = keyFromDateLocal(base);
    var dkZ = keyFromDateLocal(
      new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)
    );
    var dkPz = keyFromDateLocal(
      new Date(base.getFullYear(), base.getMonth(), base.getDate() + 2)
    );

    var sY = applyScope(collectForDay(store, dkY));
    var sT = applyScope(collectForDay(store, dkT));
    var sZ = applyScope(collectForDay(store, dkZ));
    var sPz = applyScope(collectForDay(store, dkPz));

    var dY = parseDayKey(dkY);
    var dT = parseDayKey(dkT);
    var dZ = parseDayKey(dkZ);
    var dPz = parseDayKey(dkPz);

    var frag = document.createDocumentFragment();

    var sOver = applyScope(collectOverdue(store, dkY)); // keys strictly before "Вчора"
    frag.appendChild(sectionOverdueGrouped("Прострочені до", dY, sOver));
    frag.appendChild(section("Вчора", dY, sY));
    frag.appendChild(section("Сьогодні", dT, sT));
    frag.appendChild(section("Завтра", dZ, sZ));
    frag.appendChild(section("Післязавтра", dPz, sPz));

    mount.innerHTML = "";
    mount.appendChild(frag);

    // === Apply active legend filter after each render ===
    if (global.__planningLegendApply) {
      try { global.__planningLegendApply(); } catch (e) { }
    }
  }


  // ---------- delegated chip handlers (capture) ----------
  (function installPlanningDelegatedHandlers() {
    if (window.__planningDelegatedInstalled) return;
    window.__planningDelegatedInstalled = true;
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;

    function getChipPayload(el) {
      var id = el.getAttribute("data-id");
      var date = el.getAttribute("data-date") || el.getAttribute("data-start") || null;
      // Fallback: try li data-date if present
      if (!date) {
        var li = el.closest(".planning-today__item");
        if (li && li.getAttribute) date = li.getAttribute("data-date");
      }
      return { id: id, date: date };
    }

    function openInfo(date, id) {
      if (!date || !id) return;
      var fn = (window.CalendarApp && window.CalendarApp.ui && window.CalendarApp.ui.openModalInfo) ? window.CalendarApp.ui.openModalInfo : null;
      var d2 = resolveEventDayById(id, date) || date;
      if (fn) fn(d2, id); else tryOpenInfo(d2, id);
    }

    function openEdit(date, id) {
      if (!date || !id) return;
      var fn = (window.CalendarApp && window.CalendarApp.ui && window.CalendarApp.ui.openModalEdit) ? window.CalendarApp.ui.openModalEdit : null;
      var d2 = resolveEventDayById(id, date) || date;
      if (fn) fn(d2, id); else tryOpenInfo(d2, id);
    }

    mount.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest(".chip");
      if (!el) return;
      var pay = getChipPayload(el);
      if (!pay.id) return;
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) openEdit(pay.date, pay.id);
      else openInfo(pay.date, pay.id);
    }, true);

    mount.addEventListener("dblclick", function (e) {
      var el = e.target.closest && e.target.closest(".chip");
      if (!el) return;
      var pay = getChipPayload(el);
      if (!pay.id) return;
      e.preventDefault(); e.stopPropagation();
      openEdit(pay.date, pay.id);
    }, true);

    mount.addEventListener("contextmenu", function (e) {
      var el = e.target.closest && e.target.closest(".chip");
      if (!el) return;
      var pay = getChipPayload(el);
      if (!pay.id) return;
      e.preventDefault(); e.stopPropagation();
      openInfo(pay.date, pay.id);
    }, true);
  })();
  // ---------- init ----------
  function planing_init() {
    ensureStore(function (store) {
      render(store || {});
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", planing_init);
  } else {
    planing_init()
  }

  // ---------- public refresh ----------
  function refreshPlanning(opts) {
    if (
      opts &&
      opts.forceServerReload &&
      Data &&
      typeof Data.serverLoadStore === "function"
    ) {
      Data.serverLoadStore()
        .then(function (resp) {
          var shaped =
            typeof Data.ensureStoreShape === "function"
              ? Data.ensureStoreShape(resp)
              : resp || {};
          if (typeof Data._setCache === "function") Data._setCache(shaped);
          render(shaped || {});
        })
        .catch(function () {
          ensureStore(function (store) {
            render(store || {});
          });
        });
    } else {
      ensureStore(function (store) {
        render(store || {});
      });
    }
  }


  // встановлюємо обробку змін
  setInterval(() => {
    console.log('refresh planning');
    refreshPlanning();
  }, 10_000);

  /* ===================================================================
     Inline Planning Legend Filters (+ Clear 'X' button)
     - Binds to existing .legend buttons (span.lg ...)
     - Adds clear button "X" that resets filters to 'all' and hides itself
     - No external CSS; uses inline style.display toggling
     - Filters: today, overdue, type-mi, type-nas, type-evt, type-other
     =================================================================== */
  (function installLegendFilters() {
    if (global.__planningLegendInstalled) return;
    global.__planningLegendInstalled = true;

    var doc = global.document;
    var state = { active: 'all' };
    var clearBtn = null; // span.lg with "X"

    function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
    function $all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
    function pad2(n) { return ('0' + n).slice(-2); }
    function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    function nowHM() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
    function normalizeISO(s) {
      if (!s) return null; s = String(s).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      var m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); if (m) return m[3] + '-' + m[2] + '-' + m[1];
      return null;
    }
    function normalizeHM(s) {
      if (!s) return null; s = String(s).trim();
      var m = s.match(/^(\d{1,2})[:.](\d{2})$/); if (m) return pad2(+m[1]) + ':' + pad2(+m[2]);
      var m2 = s.match(/^(\d{1,2})$/); if (m2) return pad2(+m2[1]) + ':00';
      return null;
    }

    function parseMeta(el) {
      var type = (el.getAttribute('data-type') || 'other').toLowerCase();
      var done = (el.getAttribute('data-done') === '1') || el.classList.contains('done');
      var urgent = (el.getAttribute('data-urgent') === '1') || el.classList.contains('urgent');
      var date = normalizeISO(el.getAttribute('data-ev-date') || el.getAttribute('data-date'));
      var endDate = normalizeISO(el.getAttribute('data-ev-end-date'));
      var start = normalizeHM(el.getAttribute('data-ev-start'));
      var end = normalizeHM(el.getAttribute('data-ev-end'));
      return { type: type, done: done, urgent: urgent, date: date, endDate: endDate, start: start, end: end };
    }

    function containsToday(dateISO, endDateISO) {
      var t = todayISO();
      if (!dateISO) return false;
      if (!endDateISO) return dateISO === t;
      return dateISO <= t && t <= endDateISO;
    }

    function isOverdueStrict(meta) {
      // Adapter-only: delegate to global isEventOverdueStrict(ev)
      var ev = {
        done: !!(meta && meta.done),

        // dates in 'YYYY-MM-DD'
        start_date: (meta && meta.date) ? String(meta.date).slice(0, 10) : '',
        end_date: (meta && meta.endDate) ? String(meta.endDate).slice(0, 10) : '',

        // times in 'HH:MM'
        time: (meta && meta.start) ? String(meta.start).slice(0, 5) : '',
        end_time: (meta && meta.end) ? String(meta.end).slice(0, 5) : ''
      };

      if (typeof isEventOverdueStrict !== 'function') return false;
      return !!isEventOverdueStrict(ev);
    }


    function matches(meta, filter) {
      switch (filter) {
        case 'all': return true;
        case 'today': return containsToday(meta.date, meta.endDate);
        case 'overdue': return isOverdueStrict(meta);
        case 'type-mi': return meta.type === 'mi';
        case 'type-nas': return meta.type === 'nas';
        case 'type-evt': return meta.type === 'evt';
        case 'type-other': return meta.type === 'other';
        default: return true;
      }
    }

    function getAllItems() {
      var mount = document.getElementById('planning-today');
      if (!mount) return [];
      return $all('.planning-today__item', mount);
    }

    function updateClearVisibility() {
      if (!clearBtn) return;
      clearBtn.style.display = (state.active === 'all') ? 'none' : '';
    }

    function apply() {
      var items = getAllItems();
      var total = items.length, visible = 0;
      for (var i = 0; i < items.length; i++) {
        var el = items[i];
        var meta = parseMeta(el);
        if (matches(meta, state.active)) {
          el.style.display = '';
          visible++;
        } else {
          el.style.display = 'none';
        }
      }

      // Hide empty sections (optional, cosmetic)
      var sections = $all('.planning-section', document.getElementById('planning-today'));
      for (var s = 0; s < sections.length; s++) {
        var ul = sections[s].querySelector('.planning-today__list');
        if (!ul) continue;
        var anyVisible = Array.prototype.some.call(ul.children || [], function (li) {
          return li && li.style.display !== 'none';
        });
        sections[s].style.display = anyVisible ? '' : 'none';
      }

      updateClearVisibility();

      try {
        document.dispatchEvent(new CustomEvent('planning:filters-applied', { detail: { filter: state.active, visibleCount: visible, total: total } }));
      } catch (e) { }
    }

    function detectFilterFromLegendSpan(span) {
      var txt = span.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
      if (span.classList.contains('ev--overdue-flash') || txt.indexOf('простроч') !== -1) return 'overdue';
      if (txt.indexOf('сьогодні') !== -1) return 'today';
      if (txt.indexOf('тлг') !== -1 && txt.indexOf('ми') !== -1) return 'type-mi';
      if (txt.indexOf('тлг') !== -1 && txt.indexOf('нас') !== -1) return 'type-nas';
      if (txt.indexOf('захід') !== -1) return 'type-evt';
      if (txt.indexOf('інше') !== -1) return 'type-other';
      return null;
    }

    function setActiveLegend(legendEl, targetSpan) {
      var spans = $all('.lg', legendEl);
      for (var i = 0; i < spans.length; i++) {
        spans[i].classList.remove('is-active');
        spans[i].setAttribute('aria-pressed', 'false');
      }
      if (targetSpan && targetSpan.getAttribute('data-filter') !== 'clear') {
        targetSpan.classList.add('is-active');
        targetSpan.setAttribute('aria-pressed', 'true');
      }
    }

    function ensureClearButton(legend) {
      // Reuse existing if already present
      clearBtn = legend.querySelector('.lg[data-filter="clear"]');
      if (clearBtn) { updateClearVisibility(); return; }

      // Create new span.lg "X" to match design
      clearBtn = document.createElement('span');
      clearBtn.className = 'lg lg--clear';
      clearBtn.setAttribute('data-filter', 'clear');
      clearBtn.setAttribute('title', 'Скинути фільтри');
      clearBtn.textContent = 'X';
      clearBtn.style.cursor = 'pointer';
      clearBtn.style.display = 'none'; // hidden by default

      // Append at the end of legend
      legend.appendChild(clearBtn);

      clearBtn.addEventListener('click', function () {
        var legendEl = document.querySelector('.legend');
        state.active = 'all';
        setActiveLegend(legendEl, null);
        apply();
      });
    }

    function wireLegend() {
      var legend = document.querySelector('.legend');
      if (!legend) return;
      var spans = $all('.lg', legend);
      spans.forEach(function (sp) {
        var f = detectFilterFromLegendSpan(sp);
        if (f) sp.setAttribute('data-filter', f);
        sp.style.cursor = 'pointer';
        sp.addEventListener('click', function () {
          var filter = sp.getAttribute('data-filter');
          if (!filter || filter === 'clear') return;
          if (state.active === filter) {
            state.active = 'all';
            setActiveLegend(legend, null);
          } else {
            state.active = filter;
            setActiveLegend(legend, sp);
          }
          try { document.dispatchEvent(new CustomEvent('planning:filters-change', { detail: { filter: state.active } })); } catch (e) { }
          apply();
        });
      });

      ensureClearButton(legend);
      updateClearVisibility();
    }

    // Install on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wireLegend);
    } else {
      wireLegend();
    }

    // Public apply for re-renders
    global.__planningLegendApply = apply;

    // Re-apply when external code asks
    document.addEventListener('planning:rerender', function () { apply(); });
  })();

})(window);
