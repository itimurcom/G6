(function () {
    var elList = document.getElementById('audit-list');
    if (!elList) return;
    var isAdmin = String(elList.dataset.isAdmin) === '1';
    var scopeRadios = document.querySelectorAll('input[name="audit_scope"]');
    var q = document.getElementById('audit-q');
    var selAction = document.getElementById('audit-action');
    var selLimit = document.getElementById('audit-limit');
    var btnPrev = document.getElementById('audit-prev');
    var btnNext = document.getElementById('audit-next');
    var btnRefresh = document.getElementById('audit-refresh');
    var cursors = { next: null, prev: null };
    var offset = 0;
    function currentScope() {
        if (!isAdmin) return 'me';
        var r = Array.prototype.slice.call(scopeRadios).find(function (r) { return r.checked; });
        return r ? r.value : 'me';
    }
    function apiUrl(extra) {
        var base = '/api/audit/list';
        var p = new URLSearchParams();
        p.set('limit', selLimit.value || '50');
        p.set('scope', currentScope());
        if (q.value.trim()) p.set('q', q.value.trim());
        if (selAction.value) p.set('action', selAction.value);
        p.set('offset', String(extra && typeof extra.offset === 'number' ? extra.offset : offset));
        return base + '?' + p.toString();
    }
    function renderItem(it) {
        var li = document.createElement('div');
        li.className = 'audit-item ' + cssType(it);
        var tsIso = (it.ts || '').replace(' ', 'T').replace('Z', '') + 'Z';
        var ts = new Date(tsIso);
        li.innerHTML =
            '<div class="head">' +
            '<span class="ts" title="' + (it.ts || '') + '">' + (isNaN(ts.getTime()) ? (it.ts || '') : ts.toLocaleString()) + '</span>' +
            '<span class="user">' + esc(it.user_name || '—') + '</span>' +
            '<span class="action">' + esc(it.action || '') + '</span>' +
            '<span class="result ' + (it.result || '') + '">' + (it.result || '') + '</span>' +
            '</div>' +
            '<div class="body">' +
            (it.message ? '<div class="msg">' + esc(it.message) + '</div>' : '') +
            (it.entity_type ? '<div class="entity">' + esc(it.entity_type) + '#' + esc(it.entity_id || '') + '</div>' : '') +
            (it.delta ? '<pre class="delta">' + esc(renderDelta(it.delta)) + '</pre>' : '') +
            '</div>';
        return li;
    }
    function cssType(it) {
        if (it.action === 'auth.login') return 't-login';
        if (it.action === 'auth.logout') return 't-logout';
        if (it.action === 'event.create') return 't-create';
        if (it.action === 'event.update') return 't-update';
        if (it.action === 'event.delete') return 't-delete';
        return 't-other';
    }
    function renderDelta(delta) {
        try { if (typeof delta === 'string') delta = JSON.parse(delta); } catch (e) { }
        if (!delta) return '';
        return Object.entries(delta || {}).map(function (kv) { return kv[0] + ': ' + kv[1]; }).join('\n');
    }
    function esc(s) { s = (s || '').toString(); return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    async function loadAt(newOffset, mode) {
        var url = apiUrl({ offset: newOffset });
        var r = await fetch(url);
        var j = await r.json();
        var frag = document.createDocumentFragment();
        (j.items || []).forEach(function (it) { frag.appendChild(renderItem(it)); });
        if (mode === 'replace') { elList.innerHTML = ''; elList.appendChild(frag); }
        if (mode === 'append') { elList.appendChild(frag); }
        if (mode === 'prepend') { elList.prepend(frag); }
        cursors.next = j.next; cursors.prev = j.prev;
        btnNext.disabled = !cursors.next; btnPrev.disabled = !cursors.prev;
        offset = newOffset;
    }
    async function loadInitial() { await loadAt(0, 'replace'); }
    async function loadNext() { if (cursors.next) await loadAt(cursors.next.offset, 'append'); }
    async function loadPrev() { if (cursors.prev) await loadAt(cursors.prev.offset, 'prepend'); }
    btnRefresh.addEventListener('click', loadInitial);
    btnNext.addEventListener('click', loadNext);
    btnPrev.addEventListener('click', loadPrev);
    [q, selAction, selLimit].forEach(function (el) { el.addEventListener('change', loadInitial); });
    Array.prototype.slice.call(scopeRadios).forEach(function (r) { r.addEventListener('change', loadInitial); });
    loadInitial();
})();