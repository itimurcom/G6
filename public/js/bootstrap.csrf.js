// bootstrap.csrf.js — attach X-CSRF-Token to all same-origin write requests
(function(){
  function getCookie(name){
    const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? m.pop() : '';
  }
  const origFetch = window.fetch;
  window.fetch = async function(input, init){
    try {
      const req = new Request(input, init);
      const method = (req.method || 'GET').toUpperCase();
      const sameOrigin = req.url.startsWith(location.origin) || req.url.startsWith('/');
      if (sameOrigin && !['GET','HEAD','OPTIONS'].includes(method)) {
        const headers = new Headers(req.headers || {});
        if (!headers.has('X-CSRF-Token')) {
          const token = getCookie('XSRF-TOKEN');
          if (token) headers.set('X-CSRF-Token', token);
        }
        init = Object.assign({}, init, { headers });
      }
    } catch(e) { /* noop */ }
    return origFetch(input, init);
  };
})();