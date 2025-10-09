/*! data.adapter.js — optional shim that exposes a legacy-like Data API on top of ApiEvents.
 *  Provides window.Data with async methods returning Promises.
 *  This file is non-invasive: include it BEFORE calendar.ui.js if you want to switch to ApiEvents gradually.
 */
(function (global) {
  if (!global.ApiEvents) {
    console.error('[DataAdapter] ApiEvents is missing. Include api.events.js first.');
    return;
  }
  const EV = global.ApiEvents;

  const Data = {
    /** Return events array for a given YYYY-MM-DD (Promise<array>) */
    async getEventsFor(date) {
      return await EV.byDate(date);
    },
    /** Return {date: events[]} for [start, end] inclusive (Promise<object>) */
    async getRange(start, end) {
      return await EV.byRange(start, end);
    },
    /** Create new event in date bucket; returns server response */
    async create(date, event) {
      return await EV.create(date, event);
    },
    /** Update event (possibly with new date); returns server response */
    async update(date, event) {
      return await EV.update(date, event);
    },
    /** Delete by id */
    async delete(id) {
      return await EV.remove(id);
    },
    /** Set done flag */
    async setDone(id, done) {
      return await EV.setDone(id, done);
    },
    /** Set urgent flag */
    async setUrgent(id, urgent) {
      return await EV.setUrgent(id, urgent);
    },
    /** Free-form search */
    async search(q) {
      return await EV.search(q);
    },
    /** Export/import helpers for UI buttons */
    async exportStore() { return await EV.exportStore(); },
    async importStore(store) { return await EV.importStore(store); }
  };

  // Saving indicator helper (optional, creates a tiny corner badge if not present)
  function ensureIndicator() {
    let el = document.getElementById('save-indicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'save-indicator';
      el.style.cssText = 'position:fixed;right:10px;bottom:10px;padding:6px 10px;border-radius:6px;background:#333;color:#fff;font:12px/1.4 sans-serif;z-index:9999;opacity:0.9;display:none;';
      document.body.appendChild(el);
    }
    return el;
  }
  function show(msg, color) {
    const el = ensureIndicator();
    el.textContent = msg;
    el.style.background = color || '#333';
    el.style.display = 'block';
    clearTimeout(show._t);
    show._t = setTimeout(() => { el.style.display = 'none'; }, 1600);
  }

  window.addEventListener('api:saving:start', () => show('Saving…', '#444'));
  window.addEventListener('api:saving:done',  () => show('Saved',   '#2e7d32'));
  window.addEventListener('api:saving:fail',  () => show('Failed',  '#c62828'));

  global.Data = Data;
})(window);
