/*! api.users.js — tiny client for /api/users/name */
(function (global) {
  const cache = new Map();

  async function getNameById(id) {
    id = Number(id) || 0;
    if (id <= 0) throw new Error('id must be a positive integer');
    if (cache.has(id)) return cache.get(id);

    const res = await fetch(`/api/users/name?id=${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });
    if (!res.ok) {
      if (res.status === 404) return null; // not found
      throw new Error('Request failed: ' + res.status);
    }
    const data = await res.json();
    const name = data && data.ok ? (data.name || null) : null;
    cache.set(id, name);
    return name;
  }

  global.ApiUsers = Object.freeze({
    getNameById,
  });
})(window);
