/* calendar.data.js — робота з даними (API/db.json, кеш, дебаунс) */
(function (global) {
  "use strict";

  var API_BASE = '/api/events';
  var storeCache = {};
  var _saveTimer = null;

  // ===== API V2 migration helpers =====
  // NOTE: UI expects "store shape" = { 'YYYY-MM-DD': [event, ...], ... }.
  // V2 endpoints are table-like; we adapt here without touching UI code.
  var V2_LOOKBACK_DAYS = 730;   // how many days back to load on init/refresh
  var V2_LOOKAHEAD_DAYS = 730;  // how many days forward to load on init/refresh

  // Shadow copy of what we last loaded/synced from server (store shape)
  var _v2ServerShadow = null;

  // Sync guard (because UI can call writeStore frequently)
  var _v2SyncInFlight = false;
  var _v2SyncQueued = false;
  var _v2SyncPromise = null;

  function _isDateKey(k) { return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k); }

  function _toISODate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function _addDays(iso, days) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + (days || 0));
    return _toISODate(d);
  }

  function _calcV2Range() {
    var today = _toISODate(new Date());
    return {
      start: _addDays(today, -V2_LOOKBACK_DAYS),
      end: _addDays(today, +V2_LOOKAHEAD_DAYS)
    };
  }

  function _deepClone(x) {
    try { return JSON.parse(JSON.stringify(x || {})); } catch (_) { return {}; }
  }

  function _stableStringify(x) {
    if (x === null || x === undefined) return String(x);
    if (typeof x !== 'object') return JSON.stringify(x);

    if (Array.isArray(x)) {
      return '[' + x.map(_stableStringify).join(',') + ']';
    }

    var keys = Object.keys(x).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      parts.push(JSON.stringify(k) + ':' + _stableStringify(x[k]));
    }
    return '{' + parts.join(',') + '}';
  }

  function _normalizeEventForCompare(ev) {
    if (!ev || typeof ev !== 'object') return {};
    var out = {};
    for (var k in ev) {
      if (!Object.prototype.hasOwnProperty.call(ev, k)) continue;
      if (k === '_date') continue; // derived, not canonical
      out[k] = ev[k];
    }
    return out;
  }

  function _newClientId() {
    // lightweight id: e_<16 hex>
    var rnd = (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)).slice(0, 16);
    return 'e_' + rnd;
  }

  function _compactStore(store) {
    var out = {};
    for (var date in (store || {})) {
      if (!Object.prototype.hasOwnProperty.call(store, date)) continue;
      if (!_isDateKey(date)) continue;
      var arr = store[date];
      if (Array.isArray(arr) && arr.length) out[date] = arr;
    }
    return out;
  }

  function _ensureIdsInStore(store) {
    for (var date in store) {
      if (!Object.prototype.hasOwnProperty.call(store, date)) continue;
      if (!_isDateKey(date)) continue;
      var arr = store[date];
      if (!Array.isArray(arr)) continue;
      for (var i = 0; i < arr.length; i++) {
        var ev = arr[i];
        if (!ev || typeof ev !== 'object') continue;
        if (!ev.id) { ev.id = _newClientId(); }
      }
    }
    return store;
  }

  function _indexStoreById(store) {
    var out = {};
    for (var date in store) {
      if (!Object.prototype.hasOwnProperty.call(store, date)) continue;
      if (!_isDateKey(date)) continue;
      var arr = store[date];
      if (!Array.isArray(arr)) continue;
      for (var i = 0; i < arr.length; i++) {
        var ev = arr[i];
        if (!ev || typeof ev !== 'object') continue;
        var id = String(ev.id || '');
        if (!id) continue;
        out[id] = { date: date, event: ev };
      }
    }
    return out;
  }

  function _buildV2Ops(oldStore, newStore) {
    var oldIdx = _indexStoreById(oldStore || {});
    var newIdx = _indexStoreById(newStore || {});
    var ops = [];

    // create + update
    for (var id in newIdx) {
      if (!Object.prototype.hasOwnProperty.call(newIdx, id)) continue;
      var n = newIdx[id];
      var o = oldIdx[id];
      if (!o) {
        ops.push({ kind: 'create', id: id, date: n.date, event: n.event });
        continue;
      }

      var sameDate = (o.date === n.date);
      var sameBody = (_stableStringify(_normalizeEventForCompare(o.event)) === _stableStringify(_normalizeEventForCompare(n.event)));
      if (!sameDate || !sameBody) {
        ops.push({ kind: 'update', id: id, date: n.date, event: n.event });
      }
    }

    // delete
    for (var oldId in oldIdx) {
      if (!Object.prototype.hasOwnProperty.call(oldIdx, oldId)) continue;
      if (!newIdx[oldId]) {
        ops.push({ kind: 'delete', id: oldId });
      }
    }

    return ops;
  }

  function _postJson(url, bodyObj) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj || {})
    }).then(async function (r) {
      var text = await r.text();
      var payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch (_) { }
      return { ok: r.ok, status: r.status, statusText: r.statusText, payload: payload, raw: text };
    });
  }

  function serverLoadStoreV2() {
    var rr = _calcV2Range();
    var url = API_BASE + '/by-range?start=' + encodeURIComponent(rr.start) + '&end=' + encodeURIComponent(rr.end);
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(async function (r) {
        var text = await r.text();
        var payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch (_) { }
        if (!r.ok || !payload || payload.ok !== true) {
          console.groupCollapsed('[API V2] GET ' + url + ' ERROR', r.status, r.statusText);
          console.log('raw:', text);
          console.log('json:', payload);
          console.groupEnd();
          throw new Error('API V2 load failed: ' + r.status);
        }
        var store = _compactStore(ensureStoreShape(payload.data || {}));
        _v2ServerShadow = _deepClone(store);
        return store;
      });
  }

  function serverSaveStoreV2(data) {
    // Avoid parallel sync; queue the newest store
    if (_v2SyncInFlight) {
      _v2SyncQueued = true;
      return _v2SyncPromise || Promise.resolve({ ok: true, queued: true });
    }

    _v2SyncInFlight = true;

    // делегуємо індикатор, якщо UI вже підключений
    if (global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.showSaving) {
      global.CalendarApp.ui.showSaving('Збереження…');
    }

    var nextStore = _compactStore(ensureStoreShape(data));
    _ensureIdsInStore(nextStore);

    var baseShadow = _compactStore(ensureStoreShape(_v2ServerShadow || {}));
    var ops = _buildV2Ops(baseShadow, nextStore);

    if (!ops.length) {
      if (global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.hideSaving) {
        global.CalendarApp.ui.hideSaving(true);
      }
      _v2SyncInFlight = false;
      return Promise.resolve({ ok: true, noop: true });
    }

    _v2SyncPromise = (async function () {
      var applied = 0;

      for (var i = 0; i < ops.length; i++) {
        var op = ops[i];

        if (op.kind === 'delete') {
          var delRes = await _postJson(API_BASE + '/delete', { id: op.id });
          if (!delRes.ok) {
            // delete is idempotent; ignore not_found-like errors
            if (delRes.payload && delRes.payload.error === 'not_found') { continue; }
            throw new Error('delete failed: ' + (delRes.payload ? JSON.stringify(delRes.payload) : delRes.raw));
          }
          applied++;
          continue;
        }

        if (op.kind === 'create') {
          var evCreate = Object.assign({}, op.event || {});
          // id should be preserved (UI relies on it)
          var createRes = await _postJson(API_BASE + '/create', { date: op.date, event: evCreate });
          if (!createRes.ok || !createRes.payload || createRes.payload.ok !== true) {
            // fallback to update (in case event exists)
            var evUp = Object.assign({}, op.event || {});
            delete evUp.id;
            var updFallback = await _postJson(API_BASE + '/update', { id: op.id, date: op.date, event: evUp });
            if (!updFallback.ok || !updFallback.payload || updFallback.payload.ok !== true) {
              throw new Error('create failed: ' + (createRes.payload ? JSON.stringify(createRes.payload) : createRes.raw));
            }
          }
          applied++;
          continue;
        }

        if (op.kind === 'update') {
          var ev = Object.assign({}, op.event || {});
          delete ev.id; // id supplied separately
          var updRes = await _postJson(API_BASE + '/update', { id: op.id, date: op.date, event: ev });
          if (!updRes.ok || !updRes.payload || updRes.payload.ok !== true) {
            // fallback to create (rare)
            var evCreate2 = Object.assign({}, op.event || {});
            var createFallback = await _postJson(API_BASE + '/create', { date: op.date, event: evCreate2 });
            if (!createFallback.ok || !createFallback.payload || createFallback.payload.ok !== true) {
              throw new Error('update failed: ' + (updRes.payload ? JSON.stringify(updRes.payload) : updRes.raw));
            }
          }
          applied++;
          continue;
        }
      }

      // all good → update shadow
      _v2ServerShadow = _deepClone(nextStore);

      if (global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.hideSaving) {
        global.CalendarApp.ui.hideSaving(true);
      }
      return { ok: true, applied: applied, ops: ops.length };
    })()
      .catch(function (err) {
        console.error('[API V2] sync failed:', err);
        if (global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.hideSaving) {
          global.CalendarApp.ui.hideSaving(false);
        }
        return { ok: false, error: String(err && err.message ? err.message : err) };
      })
      .finally(function () {
        _v2SyncInFlight = false;
        // if changes happened during sync — run again with the latest cache
        if (_v2SyncQueued) {
          _v2SyncQueued = false;
          try { serverSaveStoreV2(storeCache); } catch (_) { }
        }
      });

    return _v2SyncPromise;
  }


  function ensureStoreShape(x) {
    return (x && typeof x === 'object' && !Array.isArray(x)) ? x : {};
  }

  function serverLoadStore() {
    return serverLoadStoreV2();
  }

  function serverSaveStore(data) {
    return serverSaveStoreV2(data);
  }

  function readStore() { return ensureStoreShape(storeCache); }

  // Дебаунс POST, щоб не створювати гонки при швидких діях
  function writeStore(data) {
    storeCache = ensureStoreShape(data);
    console.debug('[store] queued POST', storeCache);
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      _saveTimer = null;
      console.debug('[store] POST now', storeCache);
      serverSaveStore(storeCache);
    }, 150);
  }

  function getEventsFor(dateISO) {
    var s = ensureStoreShape(storeCache);
    return Array.isArray(s[dateISO]) ? s[dateISO] : [];
  }

  function setEventsFor(dateISO, arr) {
    var s = ensureStoreShape(storeCache);
    s[dateISO] = Array.isArray(arr) ? arr : [];
    writeStore(s);
  }

  // Експорт у глобал
  global.CalendarApp = global.CalendarApp || {};
  global.CalendarApp.data = {
    API_BASE,
    ensureStoreShape,
    serverLoadStore,
    serverSaveStore,
    readStore,
    writeStore,
    getEventsFor,
    setEventsFor,
    _getCache: function () { return storeCache; },
    _setCache: function (x) { storeCache = ensureStoreShape(x); }
  };
})(window);
