// Unified API fetch wrapper with CSRF + 401/403 handling
function getCookie(name) {
  const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return m ? m.pop() : '';
}

export async function apiFetch(url, opts = {}) {
  const headers = new Headers(opts.headers || {});
  const csrf = getCookie('XSRF-TOKEN');
  if (csrf) headers.set('X-CSRF-Token', csrf);
  headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && !(opts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }
  const res = await fetch(url, { ...opts, headers, credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/login';
    return res;
  }
  if (res.status === 403) {
    alert('Security check failed (CSRF). Please reload the page.');
    throw new Error('CSRF failed');
  }
  return res;
}
