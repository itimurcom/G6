/* calendar.data.js — робота з даними (API/db.json, кеш, дебаунс) */
(function (global) {
  "use strict";

  var API_BASE = '/api/events';
  var storeCache = {};
  var _saveTimer = null;

  function ensureStoreShape(x){
    return (x && typeof x==='object' && !Array.isArray(x)) ? x : {};
  }

  function serverLoadStore(){
    return fetch(API_BASE, { headers:{'Accept':'application/json'} })
      .then(async function(r){
        var text = await r.text();
        var data = null;
        try{ data = text ? JSON.parse(text) : null; }catch(_){}
        if(!r.ok){
          console.groupCollapsed('[API] GET /api/events', r.status, r.statusText);
          console.log('raw:', text); console.log('json:', data);
          console.groupEnd();
          throw new Error('HTTP '+r.status);
        }
        return ensureStoreShape(data && data.data);
      })
      .catch(function(err){
        console.error('[API] load failed:', err);
        return {};
      });
  }

  function serverSaveStore(data){
    // делегуємо індикатор, якщо UI вже підключений
    if (global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.showSaving) {
      global.CalendarApp.ui.showSaving('Збереження…');
    }
    return fetch(API_BASE + '/store', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(ensureStoreShape(data))
    })
    .then(async function(r){
      var text = await r.text();
      var payload = null;
      try{ payload = text ? JSON.parse(text) : null; }catch(_){}
      if(!r.ok){
        console.groupCollapsed('[API] POST /api/events/store ERROR', r.status, r.statusText);
        console.log('raw:', text);
        console.log('json:', payload);
        console.groupEnd();
        if (global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.hideSaving) {
          global.CalendarApp.ui.hideSaving(false);
        }
        throw new Error((payload && payload.error ? payload.error : 'HTTP '+r.status) + ' — ' + (payload ? JSON.stringify(payload) : ''));
      }
      if (global.CalendarApp && global.CalendarApp.ui && global.CalendarApp.ui.hideSaving) {
        global.CalendarApp.ui.hideSaving(true);
      }
      return payload || {ok:true};
    })
    .catch(function(err){
      console.error('[API] store failed:', err);
    });
  }

  function readStore(){ return ensureStoreShape(storeCache); }

  // Дебаунс POST, щоб не створювати гонки при швидких діях
  function writeStore(data){
    storeCache = ensureStoreShape(data);
    console.debug('[store] queued POST', storeCache);
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function(){
      _saveTimer = null;
      console.debug('[store] POST now', storeCache);
      serverSaveStore(storeCache);
    }, 150);
  }

  function getEventsFor(dateISO){
    var s = ensureStoreShape(storeCache);
    return Array.isArray(s[dateISO]) ? s[dateISO] : [];
  }

  function setEventsFor(dateISO, arr){
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
    _getCache: function(){ return storeCache; },
    _setCache: function(x){ storeCache = ensureStoreShape(x); }
  };
})(window);
