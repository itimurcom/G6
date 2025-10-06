// planning.js
(function (global) {
  "use strict";
  // === Multi-day segment helpers (declarations) ===
  function _segPosition(dk, startDay, endDay) {
    if (!endDay || !startDay) return "single";
    var s = String(startDay).slice(0,10), e = String(endDay).slice(0,10), d = String(dk).slice(0,10);
    if (e < s){ var t=s; s=e; e=t; }
    if (d < s || d > e) return "single";
    if (s === e) return "single";
    if (d === s) return "start";
    if (d === e) return "end";
    return "mid";
  }
  function _segLabel(pos) {
    return pos === "start" ? "Початок"
         : pos === "mid"   ? "Продовження"
         : pos === "end"   ? "Завершення"
         : "";
  }


    // global.PlanningToday = global.PlanningToday || {};
  global.CalendarApp                = global.CalendarApp || {};
  global.CalendarApp.ui             = global.CalendarApp.ui || {};
  global.CalendarApp.ui.renderAllFn = refreshPlanning;
  
  var Data   = (global.CalendarApp && global.CalendarApp.data)   || {};
  var Ev     = (global.CalendarApp && global.CalendarApp.events) || {};
  

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
    for (var i=0;i<base.length;i++){
      var ev = base[i] || {};
      var t  = ev.time || ev.start || "00:00";
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
    (function includeSpans(){
      var cache = {};
      if (typeof Data._getCache === "function") cache = Data._getCache() || {};
      else cache = store || {};

      var keys = Object.keys(cache);
      for (var idx=0; idx<keys.length; idx++){
        var day = keys[idx];
        if (day === dk) continue;
        var list = cache[day] || [];
        for (var j=0;j<list.length;j++){
          var ev2 = list[j] || {};
          var endDay = ev2.end_date || ev2.end;
          if (!endDay) continue;

          // inside [start..end] ?
          var a = String(day).slice(0,10), b = String(endDay).slice(0,10), d = String(dk).slice(0,10);
          var s=a, e=b; if (e < s){ var tmp=s; s=e; e=tmp; }
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


  (function ensurePlanningSegCss(){
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
      var editDate = infoDate;

      // Capture per-item constants to avoid closure over 'var'
      let dk = it.dk;
      let ev = it.ev;
      let eid = (ev && ev.id && String(ev.id).trim()) ? String(ev.id) : ensureEventId((it.startDay || dk), ev);

      var li = document.createElement("li");
      li.className = "planning-today__item";
      /* data-seg is set on chip */
      
      
      if (ev.urgent) li.classList.add("urgent");
      if (ev.done) li.classList.add("done");
      li.setAttribute("data-date", dk);
      // if (eid) li.setAttribute("data-id", eid);

      var time = document.createElement("div");
      time.className = "planning-today__time";
      time.textContent = formatTime(it.display || it.start);

      var details = document.createElement("div");
      details.className = "planning-today__details";

      // chip (left) + title (right)
      var tRaw = String(ev.type || "").toLowerCase();

      var chip = document.createElement("span");
      chip.className = "chip " + _typeToClass(tRaw);
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

      // Modal handlers for info/edit
      function _openInfo(){ tryOpenInfo(infoDate, eid); }
      function _openEdit(){ if (typeof openModalEdit === "function") openModalEdit(editDate, eid); else tryOpenInfo(infoDate, eid); }

      chip.addEventListener("click", function(e){
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey) { _openEdit(); } else { _openInfo(); }
      });

      chip.addEventListener("dblclick", function(e){
        e.preventDefault(); e.stopPropagation(); _openEdit();
      });

      chip.addEventListener("keydown", function(e){
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _openInfo(); }
        if (e.key.toLowerCase() === "e" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); _openEdit(); }
      });

      chip.addEventListener("contextmenu", function(e){
        e.preventDefault(); e.stopPropagation(); _openInfo();
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

      // ---- interactions (use captured dk/eid) ----
      chip.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        let eid = e.currentTarget.getAttribute("id");
        tryOpenInfo(infoDate, eid);
      });
    }

    wrap.appendChild(ul);
    return wrap;
  }

  // ---------- page render ----------
  function render(store) {
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

    var sY = collectForDay(store, dkY);
    var sT = collectForDay(store, dkT);
    var sZ = collectForDay(store, dkZ);
    var sPz = collectForDay(store, dkPz);

    var dY = parseDayKey(dkY);
    var dT = parseDayKey(dkT);
    var dZ = parseDayKey(dkZ);
    var dPz = parseDayKey(dkPz);

    var frag = document.createDocumentFragment();
    frag.appendChild(section("Вчора", dY, sY));
    frag.appendChild(section("Сьогодні", dT, sT));
    frag.appendChild(section("Завтра", dZ, sZ));
    frag.appendChild(section("Післязавтра", dPz, sPz));

    mount.innerHTML = "";
    mount.appendChild(frag);
  }

  
  // ---------- delegated chip handlers (capture) ----------
  (function installPlanningDelegatedHandlers(){
    if (window.__planningDelegatedInstalled) return;
    window.__planningDelegatedInstalled = true;
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;

    function getChipPayload(el){
      var id = el.getAttribute("data-id");
      var date = el.getAttribute("data-date") || el.getAttribute("data-start") || null;
      // Fallback: try li data-date if present
      if (!date){
        var li = el.closest(".planning-today__item");
        if (li && li.getAttribute) date = li.getAttribute("data-date");
      }
      return { id: id, date: date };
    }

    function openInfo(date, id){
      if (!date || !id) return;
      if (typeof tryOpenInfo === "function") tryOpenInfo(date, id);
    }
    function openEdit(date, id){
      if (!date || !id) return;
      var fn = (window.CalendarApp && window.CalendarApp.ui && window.CalendarApp.ui.openModalEdit) ? window.CalendarApp.ui.openModalEdit : null;
      if (fn) fn(date, id); else openInfo(date, id);
    }

    mount.addEventListener("click", function(e){
      var el = e.target.closest && e.target.closest(".chip");
      if (!el) return;
      var pay = getChipPayload(el);
      if (!pay.id) return;
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) openEdit(pay.date, pay.id);
      else openInfo(pay.date, pay.id);
    }, true);

    mount.addEventListener("dblclick", function(e){
      var el = e.target.closest && e.target.closest(".chip");
      if (!el) return;
      var pay = getChipPayload(el);
      if (!pay.id) return;
      e.preventDefault(); e.stopPropagation();
      openEdit(pay.date, pay.id);
    }, true);

    mount.addEventListener("contextmenu", function(e){
      var el = e.target.closest && e.target.closest(".chip");
      if (!el) return;
      var pay = getChipPayload(el);
      if (!pay.id) return;
      e.preventDefault(); e.stopPropagation();
      openInfo(pay.date, pay.id);
    }, true);
  })();
// ---------- init ----------
  function init() {
    ensureStore(function (store) {
      render(store || {});
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
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

})(window);
