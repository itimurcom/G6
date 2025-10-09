/*! api.users.js
 * Unified Users API + username auto-injector
 * - <span class="user--name" [data-user-id="ID"]> → "name ( логін ) : user_id"
 * - If no data-user-id → uses /api/users/me
 * - Click / Enter on span → /cabinet?user_id=ID
 *
 */
(function (global) {
  'use strict';

  // Namespace
  var API = global.API = global.API || {};
  var Users = API.Users = API.Users || {};

  // ---------- Low-level HTTP ----------
  function fetchJSON(url) {
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  // ---------- Endpoints ----------
  var ID_ENDPOINTS = [
    function (id) { return '/api/users/get?id=' + encodeURIComponent(id); },
    function (id) { return '/api/users/name?id=' + encodeURIComponent(id); }
  ];
  var ME_ENDPOINTS = [
    function () { return '/api/users/me'; }
  ];

  // ---------- Utilities ----------
  function pick(obj, keys) {
    var out = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      out[k] = (obj && obj[k] != null) ? obj[k] : null;
    }
    return out;
  }

  function asUserShape(any) {
    // Accept `{ ok:true, user:{...} }` OR flat `{ id, name, login }`
    if (any && any.ok && any.user) return pick(any.user, ['id','name','login','email','role']);
    if (any && (any.id != null || any.name != null || any.login != null)) return pick(any, ['id','name','login','email','role']);
    return null;
  }

  function formatUser(u) {
    var name  = (u && typeof u.name === 'string' && u.name.trim()) ? u.name.trim() : (u && u.login ? String(u.login) : '');
    var login = (u && u.login) ? String(u.login) : '';
    var id    = (u && typeof u.id !== 'undefined') ? u.id : '';
    return name + ' (' + login + ') : ' + id;
  }

  function resolveById(id) {
    var i = 0;
    function next() {
      if (i >= ID_ENDPOINTS.length) return Promise.reject(new Error('all id endpoints failed'));
      var url = ID_ENDPOINTS[i++](id);
      return fetchJSON(url).then(function (j) {
        var u = asUserShape(j);
        if (u) return u;
        return next();
      }).catch(function () { return next(); });
    }
    return next();
  }

  function resolveMe() {
    var i = 0;
    function next() {
      if (i >= ME_ENDPOINTS.length) return Promise.reject(new Error('all me endpoints failed'));
      var url = ME_ENDPOINTS[i++]();
      return fetchJSON(url).then(function (j) {
        var u = asUserShape(j);
        if (u) return u;
        return next();
      }).catch(function () { return next(); });
    }
    return next();
  }

  function extractId(el) {
    // Prefer explicit attributes
    var keys = ['data-user-id','user_id','user-id','userid','data-id','data-user'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (el.hasAttribute(k)) {
        var v = String(el.getAttribute(k) || '');
        var m = v.match(/(\d{1,10})/);
        if (m && m[1]) return parseInt(m[1], 10);
      }
    }
    // Title digits
    var title = String(el.getAttribute('title') || '');
    var mt = title.match(/(\d{1,10})/);
    if (mt && mt[1]) return parseInt(mt[1], 10);
    // URL params
    try {
      var sp = new URLSearchParams(global.location.search);
      var qp = parseInt(sp.get('user_id') || sp.get('id') || sp.get('uid') || '0', 10);
      if (!isNaN(qp) && qp > 0) return qp;
    } catch (_) {}
    return 0;
  }

  // ---------- Public API ----------
  Users.get = function (id) {
    id = parseInt(id, 10);
    if (!id || id <= 0) return Promise.reject(new Error('invalid id'));
    return resolveById(id);
  };

  Users.me = function () {
    return resolveMe();
  };

  Users.text = function (user) {
    return formatUser(user);
  };

  Users.fillSpan = function (el) {
    if (!(el instanceof HTMLElement)) return Promise.resolve(null);
    if (!el.classList.contains('user--name')) return Promise.resolve(null);
    if (el.dataset.userInjected === '1') return Promise.resolve(null);

    el.dataset.userInjected = '1';
    el.setAttribute('aria-busy', 'true');

    var id = extractId(el);
    var p = (id > 0 ? resolveById(id) : resolveMe());

    return p.then(function (u) {
      if (!u || !u.id) throw new Error('no user');
      el.setAttribute('data-user-id', String(u.id));
      el.setAttribute('title', 'ID користувача: ' + u.id);
      el.textContent = formatUser(u);
      el.style.cursor = 'pointer';
      el.setAttribute('tabindex', '0');
      var go = function(){ try { global.location.href = '/cabinet?user_id=' + u.id; } catch(_){} };
      el.addEventListener('click', go);
      el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
      return u;
    }).catch(function (e) {
      el.setAttribute('data-user-inject-error', (e && e.message) ? e.message : String(e));
      return null;
    }).finally(function () {
      el.removeAttribute('aria-busy');
    });
  };

  Users.scan = function (root) {
    var nodes = (root || document).querySelectorAll('span.user--name');
    var tasks = [];
    for (var i = 0; i < nodes.length; i++) tasks.push(Users.fillSpan(nodes[i]));
    return Promise.allSettled(tasks);
  };

  Users.init = function () {
    if (Users._inited) return;
    Users._inited = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { Users.scan(document); });
    } else {
      Users.scan(document);
    }
    // Observe dynamic additions
    try {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.addedNodes) {
            for (var j = 0; j < m.addedNodes.length; j++) {
              var n = m.addedNodes[j];
              if (n && n.nodeType === 1) Users.scan(n);
            }
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  };

  // Auto-init
  try { Users.init(); } catch (_) {}

})(window);
