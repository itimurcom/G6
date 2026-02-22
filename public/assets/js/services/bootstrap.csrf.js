// bootstrap.csrf.js — attach X-CSRF-Token to all same-origin write requests
(function(){
  function getCookie(name){
    try {
      const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
      if (!m) return '';
      const v = m.pop() || '';
      try { return decodeURIComponent(v); } catch(_) { return v; }
    } catch(e) { return ''; }
  }

  function getMeta(name){
    try {
      const el = document.querySelector('meta[name="' + name + '"]');
      return el ? (el.getAttribute('content') || '') : '';
    } catch(e) { return ''; }
  }

  function getToken(){
    return getCookie('XSRF-TOKEN') || getMeta('csrf-token');
  }

  const origFetch = window.fetch;
  window.fetch = async function(input, init){
    let req;
    try {
      req = new Request(input, init);
    } catch(e) {
      return origFetch(input, init);
    }

    try {
      const method = (req.method || 'GET').toUpperCase();
      const sameOrigin = req.url.startsWith(location.origin);
      if (sameOrigin && !['GET','HEAD','OPTIONS'].includes(method)) {
        const headers = new Headers(req.headers || {});
        if (!headers.has('X-CSRF-Token')) {
          const token = getToken();
          if (token) headers.set('X-CSRF-Token', token);
        }
        req = new Request(req, { headers });
      }
    } catch(e) { /* noop */ }

    return origFetch(req);
  };
})();