function getUserHash(){try{return localStorage.getItem('calendar.userHash')||null;}catch(e){return null;}}
/*! api.events.js — unified client for Calendar API V2 + legacy fallback.
 *  Exposes global window.ApiEvents
 */
(function (global) {
  const BASE = '';

  // Simple event bus to allow UI to show save indicators
  function emit(name, detail) {
    try { global.dispatchEvent(new CustomEvent('api:' + name, { detail })); } catch (_) {}
  }

  async function req(method, url, body) {
    const opt = { method, headers: {} };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json; charset=utf-8';
      opt.body = JSON.stringify(body);
    }
    const res = await fetch(BASE + url, opt);
    if (!res.ok) {
      const t = await res.text().catch(()=>'');
      throw new Error(`[HTTP ${res.status}] ${url} :: ${t}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return await res.json();
    return await res.text();
  }

  function normalizeEventsFromByDate(date, payload) {
    // Accept forms: {ok, date, events: []} OR {[date]: []} OR []
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.events)) return payload.events;
    if (payload && payload[date] && Array.isArray(payload[date])) return payload[date];
    return [];
  }

  function normalizeStoreFromExport(payload) {
    // Accept forms: raw store (object) OR {ok, data: store}
    if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') return payload.data;
    return payload;
  }

  function normalizeRange(payload) {
    // Accept forms: raw store-like (date->array) OR {ok, data: store} OR [{date, events}]
    if (Array.isArray(payload)) {
      const out = {};
      for (const i of payload) {
        if (i && i.date && Array.isArray(i.events)) out[i.date] = i.events;
      }
      return out;
    }
    if (payload && typeof payload === 'object') {
      if (payload.data && typeof payload.data === 'object') return payload.data;
      return payload;
    }
    return {};
  }

  // in-memory per-day cache
  const cache = new Map(); // key: YYYY-MM-DD string, val: {ts, events}
  const TTL_MS = 60 * 1000;

  function getCache(d) {
    const hit = cache.get(d);
    if (!hit) return null;
    if (Date.now() - hit.ts > TTL_MS) { cache.delete(d); return null; }
    return hit.events;
  }
  function setCache(d, events) {
    cache.set(d, { ts: Date.now(), events: Array.isArray(events) ? events : [] });
  }
  function bustCache(d) { if (d) cache.delete(d); }

  const ApiEvents = {
    async exportStore() {
      try {
        const raw = await req('GET', '/api/events'); // legacy raw
        return normalizeStoreFromExport(raw);
      } catch (e) {
        const p = await req('GET', '/api/backup/export'); // {ok,data}
        return normalizeStoreFromExport(p);
      }
    },
    async importStore(store) {
      emit('saving:start');
      try {
        try {
          const res = await req('POST', '/api/events/store', store);
          emit('saving:done', res);
          return res;
        } catch (_) {
          const res = await req('POST', '/api/backup/import', { data: store });
          emit('saving:done', res);
          return res;
        }
      } catch (e) {
        emit('saving:fail', e);
        throw e;
      }
    },
    async byDate(date) {
      const c = getCache(date);
      if (c) return c;
      try {
        const p = await req('GET', `/api/events/by-date?date=${encodeURIComponent(date)}`);
        const events = normalizeEventsFromByDate(date, p);
        setCache(date, events);
        return events;
      } catch (e) {
        // Fallback to full export and slice
        const store = await this.exportStore();
        const events = Array.isArray(store?.[date]) ? store[date] : [];
        setCache(date, events);
        return events;
      }
    },
    async byRange(start, end) {
      try {
        const p = await req('GET', `/api/events/by-range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
        return normalizeRange(p);
      } catch (e) {
        const store = await this.exportStore();
        const out = {};
        const s = new Date(start), en = new Date(end);
        for (let d = new Date(s); d <= en; d.setDate(d.getDate()+1)) {
          const key = d.toISOString().slice(0,10);
          if (Array.isArray(store?.[key])) out[key] = store[key];
        }
        return out;
      }
    },
    async get(id) {
      try {
        const p = await req('GET', `/api/events/get?id=${encodeURIComponent(id)}`);
        // support {ok,event} or plain event
        return p?.event ?? p;
      } catch (e) {
        const store = await this.exportStore();
        for (const day in store) {
          const found = (store[day]||[]).find(ev => ev.id === id);
          if (found) return found;
        }
        throw e;
      }
    },
    async create(date, event) {
      emit('saving:start', { op: 'create', date });
      try {
        const res = await req('POST', '/api/events/create', { date, event });
        bustCache(date);
        emit('saving:done', res);
        return res;
      } catch (e) {
        emit('saving:fail', e);
        throw e;
      }
    },
    async update(date, event) {
      emit('saving:start', { op: 'update', date, id: event?.id });
      try {
        const res = await req('POST', '/api/events/update', { date, event });
        bustCache(date);
        const newDate = (res && res.date) ? res.date : date;
        if (newDate && newDate !== date) bustCache(newDate);
        emit('saving:done', res);
        return res;
      } catch (e) {
        emit('saving:fail', e);
        throw e;
      }
    },
    async remove(id) {
      emit('saving:start', { op: 'delete', id });
      try {
        const res = await req('POST', '/api/events/delete', { id });
        cache.clear();
        emit('saving:done', res);
        return res;
      } catch (e) {
        emit('saving:fail', e);
        throw e;
      }
    },
    async setDone(id, done) {
      emit('saving:start', { op: 'done', id, done });
      try {
        const res = await req('POST', '/api/events/done', { id, done: !!done });
        cache.clear();
        emit('saving:done', res);
        return res;
      } catch (e) {
        emit('saving:fail', e);
        throw e;
      }
    },
    async setUrgent(id, urgent) {
      emit('saving:start', { op: 'urgent', id, urgent });
      try {
        const res = await req('POST', '/api/events/urgent', { id, urgent: !!urgent });
        cache.clear();
        emit('saving:done', res);
        return res;
      } catch (e) {
        emit('saving:fail', e);
        throw e;
      }
    },
    async search(q) {
      const p = await req('GET', `/api/events/search?q=${encodeURIComponent(q)}`);
      return Array.isArray(p) ? p : (Array.isArray(p?.data) ? p.data : []);
    },
    _cache: { get: getCache, set: setCache, clear: () => cache.clear() }
  };

  global.ApiEvents = ApiEvents;
})(window);
