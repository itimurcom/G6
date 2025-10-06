// planning.js
(function (global) {
  "use strict";

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
    // Base events that start on this day
    var arr = store[dk] || [];
    var out = [];

    for (var i = 0; i < arr.length; i++) {
      var ev = arr[i] || {};
      var start = toDate(dk, ev.time || ev.start || "00:00");
      out.push({ start: start, ev: ev, dk: dk });
    }

    // Include multi‑day events that started on other days but span into dk
    try {
      var cache = (typeof Data._getCache === "function") ? (Data._getCache() || {}) : (store || {});

      function le(a, b){ return String(a) <= String(b); }
      function ge(a, b){ return String(a) >= String(b); }

      var keys = Object.keys(cache);
      for (var ki = 0; ki < keys.length; ki++) {
        var day = keys[ki];
        if (day === dk) continue;

        var list = cache[day] || [];
        for (var j = 0; j < list.length; j++) {
          var ev2 = list[j] || {};
          var endDay = ev2.end_date || ev2.end || null;
          if (!endDay) continue;

          if (ge(dk, day) && le(dk, endDay)) {
            var timeForSort = "00:00";
            if (dk === endDay && (ev2.time || ev2.end_time)) {
              timeForSort = ev2.time || ev2.end_time || "00:00";
            }
            var start2 = toDate(dk, timeForSort);
            out.push({ start: start2, ev: ev2, dk: dk });
          }
        }
      }
    } catch (e) {
      /* ignore */
    }

    out.sort(function (a, b) {
      return a.start - b.start;
    });

    return out;
}

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

      // Capture per-item constants to avoid closure over 'var'
      let dk = it.dk;
      let ev = it.ev;
      let eid = ensureEventId(dk, ev);

      var li = document.createElement("li");
      li.className = "planning-today__item";
      if (ev.urgent) li.classList.add("urgent");
      if (ev.done) li.classList.add("done");
      li.setAttribute("data-date", dk);
      // if (eid) li.setAttribute("data-id", eid);

      var time = document.createElement("div");
      time.className = "planning-today__time";
      time.textContent = formatTime(it.start);

      var details = document.createElement("div");
      details.className = "planning-today__details";

      // chip (left) + title (right)
      var tRaw = String(ev.type || "").toLowerCase();

      var chip = document.createElement("span");
      chip.className = "chip " + _typeToClass(tRaw);
      chip.textContent = _labelForType(tRaw);
      chip.id = eid;
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
        tryOpenInfo(dk, eid);
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
