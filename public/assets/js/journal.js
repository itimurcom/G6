(function () {
    var elList = document.getElementById('audit-list');
    if (!elList) return;
    var isAdmin = String(elList.dataset.isAdmin) === '1';

    // Toolbar v3: replace "Дії всіх користувачів / Мої дії" radios with a single admin-only checkbox "Мої дії".
    // For non-admin users, scope controls are hidden and the API is forced to "me" server-side.
    var chkMy = null;
    var btnClear = null;

    function updateClearButton() {
        if (!btnClear || !q) return;
        var has = !!(q.value && q.value.trim());
        try { btnClear.style.display = has ? '' : 'none'; } catch (e) { /* no-op */ }
    }

    function rebuildToolbarRow() {
        var toolbar = null;
        try {
            toolbar = (btnRefresh && btnRefresh.closest) ? btnRefresh.closest('.audit-toolbar') : document.querySelector('#audit-block .audit-toolbar');
        } catch (e) { toolbar = null; }
        if (!toolbar) return;

        // Hide old scope radios (always)
        try {
            Array.prototype.slice.call(toolbar.querySelectorAll('input[name="audit_scope"]')).forEach(function (inp) {
                try { inp.disabled = true; } catch (e) { /* no-op */ }
                var lbl = null;
                try { lbl = inp.closest ? inp.closest('label') : null; } catch (e) { lbl = null; }
                if (lbl) { try { lbl.style.display = 'none'; } catch (e) { /* no-op */ } }
                else { try { inp.style.display = 'none'; } catch (e) { /* no-op */ } }
            });
        } catch (e) { /* no-op */ }

        // Create admin-only checkbox
        if (isAdmin && !chkMy) {
            chkMy = document.createElement('input');
            chkMy.type = 'checkbox';
            chkMy.id = 'audit-my';
            chkMy.className = 'audit-my';
            chkMy.checked = false;

            var lblMy = document.createElement('label');
            lblMy.className = 'audit-my-label';
            lblMy.appendChild(chkMy);
            lblMy.appendChild(document.createTextNode(' Мої дії'));
            toolbar.appendChild(lblMy);
        }

        // Refresh button as icon
        if (btnRefresh) {
            try {
                btnRefresh.classList.add('audit-icon-btn');
                btnRefresh.textContent = '⟳';
                btnRefresh.title = 'Оновити';
                btnRefresh.setAttribute('aria-label', 'Оновити');
            } catch (e) { /* no-op */ }
        }

        // Clear button (shown only when the search query is not empty)
        if (!btnClear) {
            btnClear = document.createElement('button');
            btnClear.type = 'button';
            btnClear.id = 'audit-clear';
            btnClear.className = 'btn audit-icon-btn audit-clear-btn';
            btnClear.textContent = '✕';
            btnClear.title = 'Очистити';
            btnClear.setAttribute('aria-label', 'Очистити');
            toolbar.appendChild(btnClear);
        }

        // Re-order controls to a single horizontal row:
        // action | limit | (admin) my checkbox | search | refresh | clear
        try {
            var nodes = [];
            if (selAction) nodes.push(selAction);
            if (selLimit) nodes.push(selLimit);
            if (isAdmin && chkMy && chkMy.parentNode) nodes.push(chkMy.parentNode);
            if (q) nodes.push(q);
            if (btnRefresh) nodes.push(btnRefresh);
            if (btnClear) nodes.push(btnClear);

            nodes.forEach(function (n) { if (n) toolbar.appendChild(n); });
        } catch (e) { /* no-op */ }

        updateClearButton();
    }

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
        if (chkMy && chkMy.checked) return 'me';
        return 'all';
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
/* === Audit UI v2 (table + Ukrainian labels + numeric pagination) ===
   NOTE: This block intentionally runs AFTER the legacy implementation above.
   It replaces key DOM nodes with clones (same IDs) to detach legacy listeners and
   to avoid async-race overwriting of the new UI.
*/
(function () {
    var elListOrig = document.getElementById('audit-list');
    if (!elListOrig) return;

    function resetNode(node) {
        if (!node || !node.parentNode) return node;
        var clone = node.cloneNode(true);
        // Preserve runtime state for form controls
        try {
            var tag = (node.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA') {
                clone.value = node.value;
                clone.checked = node.checked;
            } else if (tag === 'SELECT') {
                clone.value = node.value;
            }
        } catch (e) { /* no-op */ }
        node.parentNode.replaceChild(clone, node);
        return clone;
    }

    // Detach legacy listeners and prevent legacy async fetch from overwriting the new UI
    var elList = resetNode(elListOrig);
    var q = resetNode(document.getElementById('audit-q'));
    var selAction = resetNode(document.getElementById('audit-action'));
    var selLimit = resetNode(document.getElementById('audit-limit'));
    var btnPrev = resetNode(document.getElementById('audit-prev'));
    var btnNext = resetNode(document.getElementById('audit-next'));
    var btnRefresh = resetNode(document.getElementById('audit-refresh'));

    var scopeRadios = [];
    Array.prototype.slice.call(document.querySelectorAll('input[name="audit_scope"]')).forEach(function (r) {
        scopeRadios.push(resetNode(r));
    });

    var isAdmin = String(elList.dataset.isAdmin) === '1';

    // Toolbar v3 (within v2 block): admin-only checkbox "Мої дії" + single-row layout + icon buttons.
    var chkMy = null;
    var btnClear = null;

    function updateClearButton() {
        if (!btnClear || !q) return;
        var has = !!(q.value && q.value.trim());
        try { btnClear.style.display = has ? '' : 'none'; } catch (e) { /* no-op */ }
    }

    function rebuildToolbarRow() {
        var toolbar = null;
        try {
            toolbar = (btnRefresh && btnRefresh.closest) ? btnRefresh.closest('.audit-toolbar') : document.querySelector('#audit-block .audit-toolbar');
        } catch (e) { toolbar = null; }
        if (!toolbar) return;

        // Hide old scope radios (always). Keep markup intact, just disable and hide labels.
        try {
            Array.prototype.slice.call(toolbar.querySelectorAll('input[name="audit_scope"]')).forEach(function (inp) {
                try { inp.disabled = true; } catch (e) { /* no-op */ }
                var lbl = null;
                try { lbl = inp.closest ? inp.closest('label') : null; } catch (e) { lbl = null; }
                if (lbl) { try { lbl.style.display = 'none'; } catch (e) { /* no-op */ } }
                else { try { inp.style.display = 'none'; } catch (e) { /* no-op */ } }
            });
        } catch (e) { /* no-op */ }

        // Create admin-only checkbox
        if (isAdmin && !chkMy) {
            chkMy = document.createElement('input');
            chkMy.type = 'checkbox';
            chkMy.id = 'audit-my';
            chkMy.className = 'audit-my';
            chkMy.checked = false;

            var lblMy = document.createElement('label');
            lblMy.className = 'audit-my-label';
            lblMy.appendChild(chkMy);
            lblMy.appendChild(document.createTextNode(' Мої дії'));
            toolbar.appendChild(lblMy);

            // Filter when enabled (admin only)
            chkMy.addEventListener('change', function () { try { loadPage(1); } catch (e) { /* no-op */ } });
        }

        // Refresh button as icon
        if (btnRefresh) {
            try {
                btnRefresh.classList.add('audit-icon-btn');
                btnRefresh.textContent = '⟳';
                btnRefresh.title = 'Оновити';
                btnRefresh.setAttribute('aria-label', 'Оновити');
            } catch (e) { /* no-op */ }
        }

        // Clear button (shown only when the search query is not empty)
        if (!btnClear) {
            btnClear = document.createElement('button');
            btnClear.type = 'button';
            btnClear.id = 'audit-clear';
            btnClear.className = 'btn audit-icon-btn audit-clear-btn';
            btnClear.textContent = '✕';
            btnClear.title = 'Очистити';
            btnClear.setAttribute('aria-label', 'Очистити');
            toolbar.appendChild(btnClear);

            btnClear.addEventListener('click', function () {
                if (!q) return;
                q.value = '';
                updateClearButton();
                try { loadPage(1); } catch (e) { /* no-op */ }
                try { q.focus(); } catch (e) { /* no-op */ }
            });
        }

        // Watch search input to toggle clear button visibility
        if (q && !q.__auditClearBound) {
            q.__auditClearBound = true;
            q.addEventListener('input', updateClearButton);
        }

        // Re-order controls to a single horizontal row:
        // action | limit | (admin) my checkbox | search | refresh | clear
        try {
            var nodes = [];
            if (selAction) nodes.push(selAction);
            if (selLimit) nodes.push(selLimit);
            if (isAdmin && chkMy && chkMy.parentNode) nodes.push(chkMy.parentNode);
            if (q) nodes.push(q);
            if (btnRefresh) nodes.push(btnRefresh);
            if (btnClear) nodes.push(btnClear);

            nodes.forEach(function (n) { if (n) toolbar.appendChild(n); });
        } catch (e) { /* no-op */ }

        updateClearButton();
    }

    // Hide admin-only UI if the user is not admin (the markup always exists)
    if (!isAdmin) {
        Array.prototype.slice.call(document.querySelectorAll('.admin-only')).forEach(function (n) {
            try { n.style.display = 'none'; } catch (e) { /* no-op */ }
        });
    }

    // Normalize per-page selector (default 10, options: 10/20/50)
    try {
        if (selLimit) {
            selLimit.innerHTML = '';
            ['10', '20', '50'].forEach(function (v) {
                var opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                selLimit.appendChild(opt);
            });
            selLimit.value = '10';
        }
    } catch (e) { /* no-op */ }

    rebuildToolbarRow();

    injectAuditUiCss();
    ensureAuditModal();

    var ui = buildAuditTable(elList);

    var state = {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1
    };

    function currentScope() {
        if (!isAdmin) return 'me';
        if (chkMy && chkMy.checked) return 'me';
        return 'all';
    }

    function apiUrl(offset) {
        var base = '/api/audit/list';
        var p = new URLSearchParams();
        state.limit = parseInt((selLimit && selLimit.value) || String(state.limit), 10) || 10;
        p.set('limit', String(state.limit));
        p.set('scope', currentScope());
        if (q && q.value && q.value.trim()) p.set('q', q.value.trim());
        if (selAction && selAction.value) p.set('action', selAction.value);
        p.set('offset', String(typeof offset === 'number' ? offset : 0));
        return base + '?' + p.toString();
    }

    function esc(s) { s = (s || '').toString(); return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function escAttr(s) { s = (s || '').toString(); return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function formatTs(tsRaw) {
        // Backend provides "YYYY-MM-DD HH:mm:ss".
        var tsIso = (tsRaw || '').replace(' ', 'T').replace('Z', '') + 'Z';
        var d = new Date(tsIso);
        if (isNaN(d.getTime())) return (tsRaw || '').toString();
        try {
            return d.toLocaleString('uk-UA', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch (e) {
            return d.toLocaleString();
        }
    }

    function uaActionLabel(action) {
        if (action === 'auth.login') return 'Вхід у систему';
        if (action === 'auth.logout') return 'Вихід із системи';
        if (action === 'calendar.event.create') return 'Створення події';
        if (action === 'calendar.event.update') return 'Зміна події';
        if (action === 'calendar.event.delete') return 'Видалення події';
        if (action === 'calendar.event.done') return 'Зміна статусу виконання';
        if (action === 'calendar.event.urgent') return 'Зміна терміновості';
        if (action === 'auth.register') return 'Реєстрація користувача';
        if (action === 'cabinet.change_password') return 'Зміна власного пароля';
        if (action === 'cabinet.profile_update') return 'Оновлення профілю';
        if (action === 'cabinet.admin_user_update') return 'Редагування користувача (Адмін)';
        if (action === 'cabinet.admin_user_password') return 'Зміна пароля користувача (Адмін)';
        if (action === 'user.create') return 'Створення користувача (Адмін)';
        if (action === 'user.update') return 'Редагування користувача (Адмін)';
        if (action === 'user.password') return 'Зміна пароля користувача (Адмін)';
        return action || 'Подія';
    }

    function uaUserFieldLabel(k) {
        var s = (k || '').toString();
        if (!s) return '';
        var t = s.toLowerCase();
        if (t === 'name') return 'Імʼя';
        if (t === 'login' || t === 'username') return 'Логін';
        if (t === 'email') return 'Email';
        if (t === 'role') return 'Роль';
        if (t === 'is_admin') return 'Прапор is_admin';
        if (t === 'password' || t === 'password_hash') return 'Пароль';
        return s;
    }

    function cssType(it) {
        if (it.action === 'auth.login') return 't-login';
        if (it.action === 'auth.logout') return 't-logout';
        if (it.action === 'calendar.event.create') return 't-create';
        if (it.action === 'calendar.event.update') return 't-update';
        if (it.action === 'calendar.event.delete') return 't-delete';
        if (it.action === 'calendar.event.done') return 't-update';
        if (it.action === 'calendar.event.urgent') return 't-update';
        if (it.action === 'auth.register') return 't-create';
        if (it.action === 'cabinet.change_password') return 't-update';
        if (it.action === 'cabinet.profile_update') return 't-update';
        if (it.action === 'cabinet.admin_user_update') return 't-update';
        if (it.action === 'cabinet.admin_user_password') return 't-update';
        if (it.action === 'user.create') return 't-create';
        if (it.action === 'user.update') return 't-update';
        if (it.action === 'user.password') return 't-update';
        return 't-other';
    }

    function asObj(v) {
        if (!v) return null;
        if (typeof v === 'object') return v;
        if (typeof v === 'string') {
            var s = v.trim();
            if (!s) return null;
            try {
                var o = JSON.parse(s);
                if (o && typeof o === 'object') return o;
            } catch (e) { /* no-op */ }
        }
        return null;
    }

    function getEventTitle(ev) {
        if (!ev || typeof ev !== 'object') return '';
        if (ev.title !== undefined && ev.title !== null && String(ev.title).trim()) return String(ev.title).trim();
        if (ev.name !== undefined && ev.name !== null && String(ev.name).trim()) return String(ev.name).trim();
        if (ev.caption !== undefined && ev.caption !== null && String(ev.caption).trim()) return String(ev.caption).trim();
        return '';
    }

    function getEventType(ev) {
        if (!ev || typeof ev !== 'object') return '';
        var t = (ev.type !== undefined && ev.type !== null) ? String(ev.type) : '';
        if (!t && ev.kind !== undefined && ev.kind !== null) t = String(ev.kind);
        if (!t && ev.category !== undefined && ev.category !== null) t = String(ev.category);
        return (t || '').trim();
    }

    function typeColor(typeText) {
        var s = (typeText || '').toString();
        if (!s) return '';
        var t = s.trim().toLowerCase();
        // Match calendar palette if available
        if (t === 'mi') return 'var(--type-mi)';
        if (t === 'nas') return 'var(--type-nas)';
        if (t === 'evt') return 'var(--type-evt)';
        if (t === 'other') return 'var(--type-other)';
        // Fallback: deterministic HSL color from string (stable across sessions).
        var h = 0;
        for (var i = 0; i < s.length; i++) {
            h = (h * 31 + s.charCodeAt(i)) >>> 0;
        }
        var hue = (h % 360);
        return 'hsl(' + hue + ', 70%, 60%)';
    }


    function typeLabel(typeText) {
        var s = (typeText || '').toString();
        if (!s) return '';
        s = s.trim();
        if (!s) return '';
        // Prefer calendar domain label if available
        try {
            if (window && window.CalendarApp && window.CalendarApp.events && typeof window.CalendarApp.events.labelForType === 'function') {
                return String(window.CalendarApp.events.labelForType(s) || s);
            }
        } catch (_) { /* no-op */ }
        var t = s.toLowerCase();
        if (t === 'mi') return 'ТЛГ: МИ';
        if (t === 'nas') return 'ТЛГ: НАС';
        if (t === 'evt') return 'Захід';
        if (t === 'other') return 'Інше';
        return s;
    }

    function pickEventSnapshot(it) {
        // Backend may return objects or JSON strings in event_before/event_after/payload.
        var after = asObj(it.event_after);
        var before = asObj(it.event_before);
        if (after) return after;
        if (before) return before;
        var payload = asObj(it.payload);
        if (payload) {
            // Common payload shapes
            if (payload.event) {
                var pe = asObj(payload.event) || (payload.event && typeof payload.event === 'object' ? payload.event : null);
                if (pe) return pe;
            }
            if (payload.after) {
                var pa = asObj(payload.after) || (payload.after && typeof payload.after === 'object' ? payload.after : null);
                if (pa) return pa;
            }
            if (payload.data) {
                var pd = asObj(payload.data) || (payload.data && typeof payload.data === 'object' ? payload.data : null);
                if (pd) return pd;
            }
        }
        // If payload itself looks like an event, return it (create action stores event directly in payload).
        if (payload && typeof payload === 'object') {
            var looksLikeEvent =
                (payload.title !== undefined) || (payload.time !== undefined) || (payload.start_date !== undefined) ||
                (payload.end_date !== undefined) || (payload.type !== undefined) || (payload.owner !== undefined) ||
                (payload.urgent !== undefined) || (payload.done !== undefined) ||
                (payload.incoming_no !== undefined) || (payload.outgoing_no !== undefined) || (payload.description !== undefined);
            if (looksLikeEvent) return payload;
        }

        return null;
    }

    function formatEventWhen(ev) {
        if (!ev || typeof ev !== 'object') return '';
        var d1 = (ev.start_date || ev.date || '').toString();
        var d2 = (ev.end_date || '').toString();
        var time = (ev.time || '').toString();
        var datePart = '';
        if (d1 && d2 && d2 !== d1) datePart = d1 + ' → ' + d2;
        else if (d1) datePart = d1;
        if (datePart && time) return datePart + ' ' + time;
        return datePart || time;
    }

    function diffEvent(before, after) {
        var changes = [];
        before = asObj(before) || before;
        after  = asObj(after)  || after;
        if (!before || !after) return changes;
        var fields = [
            ['title', 'Назва'],
            ['description', 'Опис'],
            ['time', 'Час'],
            ['start_date', 'Дата початку'],
            ['end_date', 'Дата кінця'],
            ['owner', 'Власник'],
            ['type', 'Тип'],
            ['urgent', 'Терміново'],
            ['done', 'Виконано'],
            ['incoming_no', 'Вхідний №'],
            ['outgoing_no', 'Вихідний №']
        ];
        fields.forEach(function (f) {
            var k = f[0];
            var label = f[1];
            var a = (before[k] === undefined || before[k] === null) ? '' : String(before[k]);
            var b = (after[k] === undefined || after[k] === null) ? '' : String(after[k]);
            if (a !== b) changes.push({ key: k, label: label, from: a, to: b });
        });
        return changes;
    }

    function diffUser(before, after) {
        var changes = [];
        before = asObj(before) || before;
        after  = asObj(after)  || after;
        if (!before || !after) return changes;

        var fields = [
            ['name', 'Імʼя'],
            ['login', 'Логін'],
            ['email', 'Email'],
            ['role', 'Роль'],
            ['is_admin', 'is_admin']
        ];

        fields.forEach(function (f) {
            var k = f[0];
            var label = f[1];
            var a = (before[k] === undefined || before[k] === null) ? '' : String(before[k]);
            var b = (after[k] === undefined || after[k] === null) ? '' : String(after[k]);
            if (a !== b) changes.push({ key: k, label: label, from: a, to: b });
        });

        return changes;
    }

    function buildHumanSummary(it) {
        var action = (it.action || '').toString();
        var label = uaActionLabel(action);
        var ev = pickEventSnapshot(it);
        var evTitle = getEventTitle(ev);
        var evType = getEventType(ev);
        var evWhen = formatEventWhen(ev) || (it.date ? String(it.date) : '');

        // Action-specific human labels
        if (action === 'calendar.event.done') {
            label = (it.done === true || String(it.done) === '1' || String(it.done) === 'true')
                ? 'Позначено як виконано'
                : 'Знято позначку виконано';
        }
        if (action === 'calendar.event.urgent') {
            label = (it.urgent === true || String(it.urgent) === '1' || String(it.urgent) === 'true')
                ? 'Позначено як терміново'
                : 'Знято терміновість';
        }

        // Admin user actions: show target user + changed fields (P15.18)
        var __adminUserAction = (action === 'cabinet.admin_user_update' || action === 'cabinet.admin_user_password');

        var title = label;
        if (action.indexOf('calendar.event.') === 0) {
            if (evTitle) title = label + ': «' + evTitle + '»';
            else if (it.entity_id) title = label + ': ' + String(it.entity_id);
        }

        var sub = '';
        if (action === 'auth.login' || action === 'auth.logout') {
            // IP is shown in a dedicated column.
        } else if (action === 'calendar.event.update') {
            var changes = diffEvent(it.event_before, it.event_after);
            if (changes.length) {
                sub = 'Зміни: ' + changes.slice(0, 3).map(function (c) { return c.label; }).join(', ');
                if (changes.length > 3) sub += ' …';
            }
        } else if (action === 'calendar.event.done') {
            sub = 'Статус: ' + ((it.done === true || String(it.done) === '1' || String(it.done) === 'true') ? 'виконано' : 'не виконано');
        } else if (action === 'calendar.event.urgent') {
            sub = 'Терміново: ' + ((it.urgent === true || String(it.urgent) === '1' || String(it.urgent) === 'true') ? 'так' : 'ні');
        }

        // Admin user actions: show target user in the "Подія" column, keep "Дані" as action description only.
        if (__adminUserAction) {
            var tid = (it.target_id !== undefined && it.target_id !== null) ? String(it.target_id) : '';
            if (!tid && it.entity_id !== undefined && it.entity_id !== null) tid = String(it.entity_id);

            var tlogin = (it.target_login !== undefined && it.target_login !== null) ? String(it.target_login) : '';
            var tname  = (it.target_name  !== undefined && it.target_name  !== null) ? String(it.target_name)  : '';

            var who = '';
            if (tlogin) who = '«' + tlogin + '»';
            else if (tname) who = '«' + tname + '»';
            else if (tid) who = 'ID ' + tid;
            else who = '—';

            if (action === 'cabinet.admin_user_update') {
                title = 'Редагування користувача: ' + who;
            } else if (action === 'cabinet.admin_user_password') {
                title = 'Зміна пароля користувача: ' + who;
            }

            function normErrors(errs) {
                try {
                    if (!errs) return '';
                    if (Object.prototype.toString.call(errs) === '[object Array]') return errs.join(' ');
                    if (typeof errs === 'string') return errs;
                    if (typeof errs === 'object') return Object.keys(errs).map(function (k) { return k + ': ' + errs[k]; }).join(' ');
                } catch (e) { /* no-op */ }
                return String(errs || '');
            }

            if (action === 'cabinet.admin_user_password') {
                sub = 'Пароль змінено.';
                if (String(it.result || '') !== 'success') {
                    var errText = normErrors(it.errors);
                    if (errText) sub = 'Помилка: ' + errText;
                    else sub = 'Помилка зміни пароля.';
                }
            } else {
                // Update user: show changed fields only
                var changed = it.changed;
                var chArr = [];
                if (changed) {
                    if (Object.prototype.toString.call(changed) === '[object Array]') {
                        chArr = changed.slice(0);
                    } else if (typeof changed === 'string') {
                        var s2 = changed.trim();
                        if (s2) {
                            try {
                                var o2 = JSON.parse(s2);
                                if (Object.prototype.toString.call(o2) === '[object Array]') chArr = o2;
                            } catch (e2) {
                                chArr = s2.split(/[,\s]+/).filter(Boolean);
                            }
                        }
                    } else if (typeof changed === 'object') {
                        try { chArr = Object.keys(changed); } catch (e3) { chArr = []; }
                    }
                }

                if (String(it.result || '') !== 'success') {
                    var errText2 = normErrors(it.errors);
                    if (errText2) sub = 'Помилка: ' + errText2;
                    else sub = 'Помилка збереження даних.';
                } else if (chArr && chArr.length) {
                    var labels = [];
                    chArr.forEach(function (k) {
                        var lbl = uaUserFieldLabel(k);
                        if (lbl && labels.indexOf(lbl) === -1) labels.push(lbl);
                    });
                    if (labels.length) sub = 'Зміни: ' + labels.join(', ');
                    else sub = 'Дані користувача оновлено.';
                } else {
                    sub = 'Дані користувача оновлено.';
                }
            }
        }

        if (!sub && evWhen) sub = 'Коли: ' + evWhen;
        if (!sub && it.message) sub = String(it.message);

        return { title: title, sub: sub, action: action, ev: ev, evTitle: evTitle, evType: evType };
    }

    function renderRow(it) {
        var tr = document.createElement('tr');
        tr.className = 'audit-row ' + cssType(it);

        var tsText = formatTs(it.ts || '');
        var summary = buildHumanSummary(it);
        var author = (it.user_name || '—').toString();
        var result = (it.result || '').toString();

        var tdTs = document.createElement('td');
        tdTs.className = 'audit-col-ts';
        tdTs.innerHTML = '<span class="audit-ts" title="' + escAttr(it.ts || '') + '">' + esc(tsText) + '</span>';

        var tdEv = document.createElement('td');
        tdEv.className = 'audit-col-ev';

        // For "Створення події" make whole value clickable (type + title) and open "Деталі події" dialog.
        if (summary && summary.action === 'calendar.event.create' && summary.ev && summary.evTitle) {
            var main = document.createElement('div');
            main.className = 'audit-ev-main';

            var evSnap = summary.ev;
            var itSnap = it;
            var typeSnap = summary.evType;
            var titleSnap = summary.evTitle;

            var openLink = document.createElement('a');
            openLink.href = '#';
            openLink.className = 'audit-link audit-ev-open';
            openLink.title = 'Деталі події';
            openLink.addEventListener('click', function (e) {
                try { e.preventDefault(); } catch (_) { /* no-op */ }
                openInfoEventDetails(evSnap, itSnap);
            });

            if (typeSnap) {
                var spType = document.createElement('span');
                spType.className = 'audit-ev-type';
                var cType = typeColor(typeSnap);
                if (cType) spType.style.color = cType;
                spType.textContent = '(' + typeLabel(typeSnap) + ')';
                openLink.appendChild(spType);
                openLink.appendChild(document.createTextNode(' '));
            }

            var text = document.createElement('span');
            text.className = 'audit-ev-text';
            text.textContent = (uaActionLabel('calendar.event.create') + ': «' + titleSnap + '»');
            openLink.appendChild(text);

            main.appendChild(openLink);
            tdEv.appendChild(main);

            if (false) {
                // [DEFERRED] Legacy implementation kept intentionally (do not delete).
                // For "Створення події" show clickable title + colored (type) instead of non-informative ID.
                if (summary && summary.action === 'calendar.event.create' && summary.ev && summary.evTitle) {
                    var main = document.createElement('div');
                    main.className = 'audit-ev-main';

                    var a = document.createElement('a');
                    a.href = '#';
                    a.className = 'audit-link audit-ev-link';
                    a.title = 'Відкрити подію';
                    a.textContent = (uaActionLabel('calendar.event.create') + ': «' + summary.evTitle + '»');

                    a.addEventListener('click', function (e) {
                        try { e.preventDefault(); } catch (ex) { /* no-op */ }
                        tryOpenEventPopup(summary.ev, it);
                    });

                    main.appendChild(a);

                    if (summary.evType) {
                        var sp = document.createElement('span');
                        sp.className = 'audit-ev-type';
                        var c = typeColor(summary.evType);
                        if (c) sp.style.color = c;
                        sp.textContent = ' (' + summary.evType + ')';
                        main.appendChild(sp);
                    }

                    tdEv.appendChild(main);
                }

            }
        } else {
            tdEv.innerHTML =
                '<div class="audit-ev-main">' + esc(summary.title) + '</div>';
        }

        var tdCtx = document.createElement('td');
        tdCtx.className = 'audit-col-ctx';
        tdCtx.innerHTML =
            (summary.sub ? '<div class="audit-ctx audit-ev-sub">' + esc(summary.sub) + '</div>' : '');

        var tdAu = document.createElement('td');
        tdAu.className = 'audit-col-author';
        tdAu.innerHTML = '<span class="audit-author" title="user_id: ' + escAttr(String(it.user_id || '')) + '">' + esc(author) + '</span>';

        var tdIp = document.createElement('td');
        tdIp.className = 'audit-col-ip';
        var ipText = (it.ip === undefined || it.ip === null || String(it.ip).trim() === '') ? '—' : String(it.ip);
        tdIp.innerHTML = '<span class="audit-ip">' + esc(ipText) + '</span>';

        var tdRes = document.createElement('td');
        tdRes.className = 'audit-col-result';
        tdRes.innerHTML = '<span class="audit-result audit-result--' + escAttr(result || 'other') + '">' + esc(result || '—') + '</span>';

        var tdMore = document.createElement('td');
        tdMore.className = 'audit-col-more';
        var a = document.createElement('a');
        a.href = '#';
        a.className = 'audit-link';
        a.textContent = 'Переглянути';
        a.addEventListener('click', function (e) {
            e.preventDefault();
            openAuditModal(it);
        });
        tdMore.appendChild(a);

        tr.appendChild(tdTs);
        tr.appendChild(tdEv);
        tr.appendChild(tdCtx);
        tr.appendChild(tdAu);
        tr.appendChild(tdIp);
        tr.appendChild(tdRes);
        tr.appendChild(tdMore);
        return tr;
    }

    function renderPager() {
        if (!ui.pager) return;
        ui.pager.innerHTML = '';

        var totalPages = state.totalPages || 1;
        var cur = state.page || 1;

        var pages = [];
        var push = function (n) { if (pages.indexOf(n) === -1 && n >= 1 && n <= totalPages) pages.push(n); };
        push(1);
        push(totalPages);
        for (var i = cur - 2; i <= cur + 2; i++) push(i);
        pages.sort(function (a, b) { return a - b; });

        var lastShown = 0;
        pages.forEach(function (p) {
            if (lastShown && p - lastShown > 1) {
                var dots = document.createElement('span');
                dots.className = 'audit-dots';
                dots.textContent = '…';
                ui.pager.appendChild(dots);
            }
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn audit-page-btn' + (p === cur ? ' is-active' : '');
            b.textContent = String(p);
            b.disabled = (p === cur);
            b.addEventListener('click', function () { goToPage(p); });
            ui.pager.appendChild(b);
            lastShown = p;
        });
    }

    function renderMeta() {
        if (!ui.meta) return;
        var total = state.total || 0;
        var from = total ? ((state.page - 1) * state.limit + 1) : 0;
        var to = Math.min(total, (state.page - 1) * state.limit + state.limit);
        ui.meta.textContent = total ? ('Показано ' + from + '–' + to + ' із ' + total) : 'Немає записів';
    }

    async function loadPage(page) {
        state.page = Math.max(1, page | 0);
        state.limit = parseInt((selLimit && selLimit.value) || String(state.limit), 10) || 10;

        var offset = (state.page - 1) * state.limit;
        var url = apiUrl(offset);

        var r = await fetch(url);
        var j = await r.json();

        var items = (j.items || []);
        state.total = (typeof j.total === 'number') ? j.total : items.length;
        state.totalPages = Math.max(1, Math.ceil(state.total / Math.max(1, state.limit)));

        // Clamp after knowing total
        if (state.page > state.totalPages) {
            state.page = state.totalPages;
            return loadPage(state.page);
        }

        ui.tbody.innerHTML = '';
        var frag = document.createDocumentFragment();
        items.forEach(function (it) { frag.appendChild(renderRow(it)); });
        ui.tbody.appendChild(frag);

        if (btnNext) btnNext.disabled = state.page >= state.totalPages;
        if (btnPrev) btnPrev.disabled = state.page <= 1;

        renderPager();
        renderMeta();
    }

    function goToPage(p) { loadPage(p); }
    function refresh() { loadPage(1); }

    if (btnRefresh) btnRefresh.addEventListener('click', refresh);
    if (btnNext) btnNext.addEventListener('click', function () { if (state.page < state.totalPages) loadPage(state.page + 1); });
    if (btnPrev) btnPrev.addEventListener('click', function () { if (state.page > 1) loadPage(state.page - 1); });

    [q, selAction, selLimit].forEach(function (el) { el && el.addEventListener('change', refresh); });
    Array.prototype.slice.call(scopeRadios).forEach(function (r) { r && r.addEventListener('change', refresh); });

    if (q) {
        q.addEventListener('input', updateClearButton);
        q.addEventListener('keydown', function (e) {
            if (e && e.key === 'Enter') {
                try { e.preventDefault(); } catch (e2) { /* no-op */ }
                refresh();
            }
        });
    }
    if (chkMy) chkMy.addEventListener('change', refresh);
    if (btnClear) btnClear.addEventListener('click', function () {
        if (q) {
            q.value = '';
            updateClearButton();
            try { q.focus(); } catch (e) { /* no-op */ }
        }
        refresh();
    });

    refresh();

    // ---- UI helpers ----
    function buildAuditTable(host) {
        // Ensure full-width inside the container
        try { var sec = host.closest('section'); if (sec) sec.style.width = '100%'; } catch (e) { /* no-op */ }

        host.innerHTML = '';
        host.classList.add('audit-host');

        var wrap = document.createElement('div');
        wrap.className = 'audit-table-wrap';

        var table = document.createElement('table');
        table.className = 'audit-table';

        var thead = document.createElement('thead');
        thead.innerHTML = '<tr>' +
            '<th class="audit-col-ts">Час</th>' +
            '<th class="audit-col-ev">Подія</th>' +
            '<th class="audit-col-ctx">Дані</th>' +
            '<th class="audit-col-author">Автор</th>' +
            '<th class="audit-col-ip">IP</th>' +
            '<th class="audit-col-result">Статус</th>' +
            '<th class="audit-col-more">Деталі</th>' +
            '</tr>';

        var tbody = document.createElement('tbody');
        tbody.className = 'audit-tbody';

        table.appendChild(thead);
        table.appendChild(tbody);
        wrap.appendChild(table);

        var footer = host.closest('#audit-block') ? host.closest('#audit-block').querySelector('.audit-pager') : null;
        var pager = null;
        var meta = null;
        if (footer) {
            footer.classList.add('audit-pager--pages');
            pager = footer.querySelector('#audit-pages');
            if (!pager) {
                pager = document.createElement('div');
                pager.id = 'audit-pages';
                pager.className = 'audit-pages';
                footer.insertBefore(pager, btnNext || null);
            }
            meta = footer.querySelector('#audit-meta');
            if (!meta) {
                meta = document.createElement('div');
                meta.id = 'audit-meta';
                meta.className = 'audit-meta';
                footer.appendChild(meta);
            }
        }

        host.appendChild(wrap);
        return { wrap: wrap, table: table, tbody: tbody, pager: pager, meta: meta };
    }

    function injectAuditUiCss() {
        if (document.getElementById('audit-ui-v2-style')) return;
        var st = document.createElement('style');
        st.id = 'audit-ui-v2-style';
        st.textContent = [
            '#audit-block{width:100%}',
            '#audit-block .audit-toolbar{flex-wrap:nowrap;gap:10px;align-items:center;overflow-x:auto}', '#audit-block #audit-action{flex:0 0 10%;min-width:12em}',
            '#audit-block #audit-limit{flex:0 0 5%;min-width:4em}',
            '#audit-block .audit-my-label{flex:0 0 auto;white-space:nowrap;display:flex;gap:6px;align-items:center;opacity:.85}',
            '#audit-block .audit-my-label input[type=checkbox]{accent-color:#4b9}',
            '#audit-block #audit-q{flex:1 1 auto;min-width:12em}',
            '#audit-block .audit-icon-btn{display:inline-flex;align-items:center;justify-content:center;line-height:1}',
            '#audit-block .audit-table-wrap{width:100%;overflow:auto;border:1px solid var(--border);border-radius:12px;background:var(--event-bg)}',
            '#audit-block .audit-table{width:100%;border-collapse:separate;border-spacing:0}',
            '#audit-block .audit-table th,#audit-block .audit-table td{padding:10px 12px;vertical-align:top;border-bottom:1px solid rgba(255,255,255,.06)}',
            ':root[data-theme="light"] #audit-block .audit-table th,:root[data-theme="light"] #audit-block .audit-table td{border-bottom:1px solid rgba(0,0,0,.06)}',
            '#audit-block .audit-table th{position:sticky;top:0;background:var(--event-bg);text-align:left;font-weight:700;z-index:1}',
            '#audit-block .audit-col-ts{white-space:nowrap;min-width:150px}',
            '#audit-block .audit-col-ctx{white-space:nowrap;min-width:220px}',
            '#audit-block .audit-col-author{white-space:nowrap;min-width:120px}',
            '#audit-block .audit-col-ip{white-space:nowrap;min-width:110px}',
            '#audit-block .audit-col-result{white-space:nowrap;min-width:90px}',
            '#audit-block .audit-col-more{white-space:nowrap;min-width:90px}',
            '#audit-block .audit-ev-main{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '#audit-block .audit-ev-sub{opacity:.78;font-size:12px;margin-top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '#audit-block .audit-author{color:#22c55e;font-weight:800}',
            '#audit-block .audit-ip{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;font-size:12px;opacity:.85}',
            '#audit-block .audit-result{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;font-size:12px;border:1px solid rgba(255,255,255,.10)}',
            ':root[data-theme="light"] #audit-block .audit-result{border:1px solid rgba(0,0,0,.10)}',
            '#audit-block .audit-result--success{background:rgba(34,197,94,.14)}',
            '#audit-block .audit-result--fail{background:rgba(239,68,68,.14)}',
            '#audit-block .audit-result--error{background:rgba(239,68,68,.14)}',
            '#audit-block .audit-link{color:var(--accent);text-decoration:none}',
            '#audit-block .audit-ev-link{cursor:pointer}',
            '#audit-block .audit-ev-type{font-weight:800;opacity:.95}',
            '#audit-block .audit-ev-type-link{cursor:pointer}',
            '#audit-block .audit-ev-open{display:block;width:100%;cursor:pointer;color:var(--fg, #fff);text-decoration:none}',
            '#audit-block .audit-ev-open .audit-ev-text{color:inherit}',
            '#infoOverlay #editEvBtn{background:#22c55e;border-color:#22c55e;color:#fff}',
            '#infoOverlay #editEvBtn:hover{filter:brightness(1.05)}',
            '#infoOverlay #editEvBtn:active{filter:brightness(0.95)}',

            '#audit-block .audit-link:hover{text-decoration:underline}',
            '#audit-block .audit-row.t-login .audit-ev-main{color:#60a5fa}',
            '#audit-block .audit-row.t-logout .audit-ev-main{color:#93c5fd}',
            '#audit-block .audit-row.t-create .audit-ev-main{color:#22c55e}',
            '#audit-block .audit-row.t-update .audit-ev-main{color:#fbbf24}',
            '#audit-block .audit-row.t-delete .audit-ev-main{color:#ef4444}',
            '#audit-block .audit-pager{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px}',
            '#audit-block .audit-pages{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
            '#audit-block .audit-page-btn{padding:6px 10px;border-radius:10px}',
            '#audit-block .audit-page-btn.is-active{opacity:1;outline:2px solid rgba(96,165,250,.55)}',
            '#audit-block .audit-dots{opacity:.65;padding:0 4px}',
            '#audit-block .audit-meta{margin-left:auto;opacity:.75;font-size:12px}',

            /* Modal */
            '.audit-modal{position:fixed;inset:0;z-index:4000;display:none}',
            '.audit-modal.is-open{display:block}',
            '.audit-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55)}',
            '.audit-modal__panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(980px,92vw);max-height:84vh;overflow:auto;border-radius:16px;border:1px solid var(--border);background:var(--bg);box-shadow:0 24px 80px rgba(0,0,0,.55)}',
            '.audit-modal__head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06);position:sticky;top:0;background:var(--bg);z-index:1}',
            ':root[data-theme="light"] .audit-modal__head{border-bottom:1px solid rgba(0,0,0,.06)}',
            '.audit-modal__title{font-weight:800}',
            '.audit-modal__close{appearance:none;border:1px solid var(--border);background:transparent;color:var(--fg);border-radius:10px;padding:6px 10px;cursor:pointer}',
            '.audit-modal__body{padding:12px 14px}',
            '.audit-modal__grid{display:grid;grid-template-columns:180px 1fr;gap:8px 12px;align-items:start}',
            '@media (max-width:720px){.audit-modal__grid{grid-template-columns:1fr}}',
            '.audit-k{opacity:.75}',
            '.audit-v{font-weight:600}',
            '.audit-diff{margin-top:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden}',
            ':root[data-theme="light"] .audit-diff{border:1px solid rgba(0,0,0,.10)}',
            '.audit-diff table{width:100%;border-collapse:collapse}',
            '.audit-diff th,.audit-diff td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top}',
            ':root[data-theme="light"] .audit-diff th,:root[data-theme="light"] .audit-diff td{border-bottom:1px solid rgba(0,0,0,.06)}',
            '.audit-diff th{background:var(--event-bg);text-align:left}',
            '.audit-raw{margin-top:12px}',
            '.audit-raw pre{white-space:pre-wrap;word-break:break-word;margin:8px 0 0 0;padding:10px 12px;border-radius:12px;background:var(--event-bg);border:1px solid rgba(255,255,255,.06)}',
            ':root[data-theme="light"] .audit-raw pre{border:1px solid rgba(0,0,0,.06)}'
        ].join('\n');
        document.head.appendChild(st);
    }


    function ensureEventModal() {
        if (document.getElementById('event-modal')) return;
        var root = document.createElement('div');
        root.id = 'event-modal';
        root.className = 'audit-modal';
        root.innerHTML =
            '<div class="audit-modal__backdrop" data-close="1"></div>' +
            '<div class="audit-modal__panel" role="dialog" aria-modal="true" aria-label="Подія">' +
            '  <div class="audit-modal__head">' +
            '    <div class="audit-modal__title">Подія</div>' +
            '    <button type="button" class="audit-modal__close" data-close="1">✕</button>' +
            '  </div>' +
            '  <div class="audit-modal__body" id="event-modal-body"></div>' +
            '</div>';
        document.body.appendChild(root);
        root.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.getAttribute && t.getAttribute('data-close') === '1') closeEventModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeEventModal();
        });
    }

    function openEventModal(ev, it) {
        ensureEventModal();
        var root = document.getElementById('event-modal');
        var body = document.getElementById('event-modal-body');
        if (!root || !body) return;

        var eobj = (ev && typeof ev === 'object') ? ev : pickEventSnapshot(it);
        if (!eobj || typeof eobj !== 'object') eobj = {};

        var title = getEventTitle(eobj) || (it && it.entity_id ? String(it.entity_id) : 'Подія');
        var type = getEventType(eobj);
        var when = formatEventWhen(eobj) || (it && it.date ? String(it.date) : '');

        body.innerHTML = '';
        var top = document.createElement('div');
        top.className = 'audit-modal__grid';

        var typeHtml = '—';
        if (type) {
            var c = typeColor(type);
            typeHtml = '<span class="audit-ev-type" style="' + (c ? ('color:' + escAttr(c) + ';') : '') + 'font-weight:800;">' + esc(type) + '</span>';
        }

        top.innerHTML =
            '<div class="audit-k">Назва</div><div class="audit-v">' + esc(title) + '</div>' +
            '<div class="audit-k">Тип</div><div class="audit-v">' + typeHtml + '</div>' +
            (when ? '<div class="audit-k">Коли</div><div class="audit-v">' + esc(when) + '</div>' : '') +
            ((it && it.entity_id) ? '<div class="audit-k">ID</div><div class="audit-v">' + esc(String(it.entity_id)) + '</div>' : '');

        // Optional well-known fields (show only when present)
        var fields = [
            ['time', 'Час'],
            ['start_date', 'Дата початку'],
            ['end_date', 'Дата кінця'],
            ['owner', 'Власник'],
            ['urgent', 'Терміново'],
            ['done', 'Виконано'],
            ['incoming_no', 'Вхідний №'],
            ['outgoing_no', 'Вихідний №'],
            ['department', 'Підрозділ'],
            ['place', 'Місце'],
            ['description', 'Опис'],
            ['notes', 'Нотатки']
        ];
        fields.forEach(function (f) {
            var k = f[0];
            var label = f[1];
            if (eobj[k] === undefined || eobj[k] === null) return;
            var v = eobj[k];
            var sv = (typeof v === 'object') ? JSON.stringify(v) : String(v);
            if (!sv.trim()) return;
            top.innerHTML += '<div class="audit-k">' + esc(label) + '</div><div class="audit-v">' + esc(sv) + '</div>';
        });

        body.appendChild(top);

        var raw = document.createElement('div');
        raw.className = 'audit-raw';
        raw.innerHTML = '<details open><summary>Усі поля (JSON)</summary><pre>' + esc(JSON.stringify(eobj, null, 2)) + '</pre></details>';
        body.appendChild(raw);

        root.classList.add('is-open');
    }

    function closeEventModal() {
        var root = document.getElementById('event-modal');
        if (!root) return;
        root.classList.remove('is-open');
        var body = document.getElementById('event-modal-body');
        if (body) body.innerHTML = '';
    }


    // === Event "Info" dialog (same overlay as Calendar/Planning: #infoOverlay / #infoContent) ===
    function closeInfoOverlayFromJournal() {
        var overlay = document.getElementById('infoOverlay');
        if (!overlay) return;
        if (overlay.contains(document.activeElement)) { try { document.activeElement.blur(); } catch (_) { } }
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('inert', '');
    }

    function ensureInfoOverlayModal() {
        var overlay = document.getElementById('infoOverlay');
        if (overlay) return overlay;
        try {
            var root = document.createElement('div');
            root.id = 'infoOverlay';
            root.className = 'overlay';
            root.setAttribute('aria-hidden', 'true');
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'true');
            root.setAttribute('inert', '');
            root.innerHTML =
                '<div class="modal" aria-labelledby="infoTitle">' +
                '  <header>' +
                '    <div id="infoTitle">Деталі події</div>' +
                '    <div><button type="button" id="infoClose" class="event-btn" aria-label="Закрити">×</button></div>' +
                '  </header>' +
                '  <div class="content" id="infoContent"></div>' +
                '  <footer><span></span><div style="display:flex;gap:10px;">' +
                '    <button type="button" id="editEvBtn" class="btn btn--green" hidden aria-hidden="true" tabindex="-1">редагувати</button>' +
                '    <button type="button" id="infoOk" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Закрити</button>' +
                '  </div></footer>' +
                '</div>';
            document.body.appendChild(root);
            return root;
        } catch (_) { return null; }
    }

    function setInfoModalTypeForJournal(t) {
        var overlay = document.getElementById('infoOverlay');
        if (!overlay) return;
        var modal = null;
        try { modal = overlay.querySelector('.modal'); } catch (_) { modal = null; }
        if (!modal || !modal.classList) return;
        try {
            modal.classList.remove('type-mi', 'type-nas', 'type-evt', 'type-other');
            var tt = String(t || '').toLowerCase();
            modal.classList.add(tt === 'mi' ? 'type-mi' : tt === 'nas' ? 'type-nas' : tt === 'evt' ? 'type-evt' : 'type-other');
        } catch (_) { /* no-op */ }
    }


    function ensureInfoOverlayHandlers() {
        var overlay = document.getElementById('infoOverlay');
        if (!overlay) return;
        if (overlay.dataset && overlay.dataset.journalBound === '1') return;
        try { if (overlay.dataset) overlay.dataset.journalBound = '1'; } catch (_) { }

        var btnClose = document.getElementById('infoClose');
        var btnOk = document.getElementById('infoOk');

        if (btnClose) btnClose.addEventListener('click', function (e) { try { e.preventDefault(); } catch (_) { } closeInfoOverlayFromJournal(); });
        if (btnOk) btnOk.addEventListener('click', function (e) { try { e.preventDefault(); } catch (_) { } closeInfoOverlayFromJournal(); });

        // Click on backdrop closes as well
        overlay.addEventListener('click', function (e) {
            if (e && e.target === overlay) closeInfoOverlayFromJournal();
        });

        // Esc closes
        document.addEventListener('keydown', function (e) {
            if (e && e.key === 'Escape') closeInfoOverlayFromJournal();
        });
    }


    // === Calendar/Planning "Деталі події" dialogs on Journal page (full features) ===
    var __journalCalUiPromise = null;

    function __ensureIconsCssForJournalDialogs() {
        try {
            if (document.querySelector('link[href*="/assets/css/icons.css"]')) return;
            var l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = '/assets/css/icons.css';
            l.dataset && (l.dataset.journalIcons = '1');
            document.head.appendChild(l);
        } catch (_) { /* no-op */ }
    }

    function __ensurePlanningTodayElForJournal() {
        var mt = document.getElementById('planning-today');
        if (mt) return mt;
        try {
            mt = document.createElement('div');
            mt.id = 'planning-today';
            mt.style.display = 'none';
            mt.dataset.userId = '0';
            document.body.appendChild(mt);
            return mt;
        } catch (_) { return null; }
    }

    function __ensureMeUserIdForJournal() {
        return new Promise(function (resolve) {
            var mt = __ensurePlanningTodayElForJournal();
            var cur = 0;
            try { cur = mt && mt.dataset ? (parseInt(mt.dataset.userId || '0', 10) || 0) : 0; } catch (_) { cur = 0; }
            if (cur > 0) return resolve(cur);

            try {
                fetch('/api/users/me', { headers: { 'Accept': 'application/json' } })
                    .then(function (r) { return r.json(); })
                    .then(function (x) {
                        var id = 0;
                        try { id = x && x.ok && x.user ? (parseInt(x.user.id || 0, 10) || 0) : 0; } catch (_) { id = 0; }
                        if (mt && mt.dataset && id > 0) mt.dataset.userId = String(id);
                        resolve(id);
                    })
                    .catch(function () { resolve(0); });
            } catch (_) { resolve(0); }
        });
    }

    function __ensureInfoOverlayFullForJournal() {
        var overlay = document.getElementById('infoOverlay');
        var needs = false;
        try {
            if (!overlay) needs = true;
            else if (!overlay.querySelector('#infoContent')) needs = true;
            else if (!overlay.querySelector('#editEvBtn')) needs = true;
            else if (!overlay.querySelector('#infoOk')) needs = true;
            else if (!overlay.querySelector('#infoClose')) needs = true;
            else if (!overlay.querySelector('#infoEventModal')) needs = true;
        } catch (_) { needs = true; }

        if (!needs) return overlay;

        var root = document.createElement('div');
        root.id = 'infoOverlay';
        root.className = 'overlay';
        root.setAttribute('aria-hidden', 'true');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('inert', '');
        root.innerHTML =
            '<div id="infoEventModal" class="modal" aria-labelledby="infoTitle">' +
            '  <style>#deleteEvBtn{display:none !important;}</style>' +
            '  <header>' +
            '    <div id="infoTitle">Деталі події</div>' +
            '    <div><button type="button" id="infoClose" class="event-btn" aria-label="Закрити">×</button></div>' +
            '  </header>' +
            '  <div class="content" id="infoContent"></div>' +
            '  <footer><span></span><div id="infoButtons" style="display:flex;gap:10px;">' +
            '    <button type="button" id="editEvBtn" class="btn btn--green" hidden aria-hidden="true" tabindex="-1">редагувати</button>' +
            '    <button type="button" id="infoOk" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Закрити</button>' +
            '  </div></footer>' +
            '</div>';

        try {
            if (overlay && overlay.parentNode) overlay.parentNode.replaceChild(root, overlay);
            else document.body.appendChild(root);
        } catch (_) {
            try { document.body.appendChild(root); } catch (__e) { /* no-op */ }
        }
        return root;
    }

    function __ensureEditOverlayFullForJournal() {
        var overlay = document.getElementById('eventOverlay');
        var needs = false;
        try {
            if (!overlay) needs = true;
            else if (!document.getElementById('eventModal')) needs = true;
            else if (!document.getElementById('inputDate')) needs = true;
            else if (!document.getElementById('btnDelete')) needs = true;
        } catch (_) { needs = true; }

        if (!needs) return overlay;

        var root = document.createElement('div');
        root.id = 'eventOverlay';
        root.className = 'overlay';
        root.setAttribute('aria-hidden', 'true');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('inert', '');
        root.innerHTML =
            '<form id="eventModal" class="modal" aria-labelledby="modalTitle">' +
            '  <header>' +
            '    <div class="left"><div id="modalTitle">Нова подія</div></div>' +
            '    <button type="button" id="btnClose" class="event-btn" aria-label="Закрити">×</button>' +
            '  </header>' +
            '  <div class="content">' +
            '    <div class="row col3">' +
            '      <div><label for="inputDate">Дата</label><input id="inputDate" name="date" type="date" required></div>' +
            '      <div><label for="inputSpanDays">Тривалість (днів, опц.)</label><input id="inputSpanDays" name="span_days" type="number" min="1" step="1" placeholder="1 = одноденна"></div>' +
            '      <div><label for="inputTime">Час</label><input id="inputTime" name="time" type="time" required></div>' +
            '    </div>' +
            '    <div><label for="inputTitle">Назва події</label><input id="inputTitle" name="title" type="text" placeholder="Напр., Статус-дзвінок" required></div>' +
            '    <div><label for="inputDescription">Опис</label><textarea id="inputDescription" name="description" rows="3" placeholder="Детальний опис події..." style="border-radius:8px;"></textarea></div>' +
            '    <div class="row">' +
            '      <div><label for="inputOwner">Відповідальний</label><input id="inputOwner" name="owner" type="text" placeholder="Ім\'я або команда"></div>' +
            '      <div><label for="inputType">Тип</label><select id="inputType" name="type" required>' +
            '        <option value="mi">ТЛГ: МИ</option>' +
            '        <option value="nas">ТЛГ: НАС</option>' +
            '        <option value="evt" selected>Захід</option>' +
            '        <option value="other">Інше</option>' +
            '      </select></div>' +
            '    </div>' +
            '    <div class="row">' +
            '      <div><label for="inputIncoming">Вхідний номер</label><input id="inputIncoming" name="incoming_no" type="text" autocomplete="off" placeholder="Напр.: Вх-1234/09"></div>' +
            '      <div><label for="inputOutgoing">Вихідний номер</label><input id="inputOutgoing" name="outgoing_no" type="text" autocomplete="off" placeholder="Напр.: Вих-5678/09"></div>' +
            '    </div>' +
            '  </div>' +
            '  <footer>' +
            '    <div class="footer-switches" style="display:flex; gap:10px; align-items:center;">' +
            '      <label id="urgentSwitch" class="urgent-switch" title="Позначити як терміново"><input type="checkbox" id="inputUrgent"> Терміново</label>' +
            '      <label id="doneSwitch" class="done-switch" title="Позначити як виконано"><input type="checkbox" id="inputDone"> Виконано</label>' +
            '    </div>' +
            '    <div style="display:flex; gap:10px;">' +
            '      <button type="button" class="btn" id="btnDelete" style="background:#ef4444;border-color:#ef4444;color:#fff" hidden aria-hidden="true" tabindex="-1">Видалити</button>' +
            '      <button type="button" class="btn" id="btnCancel">Скасувати</button>' +
            '      <button type="submit" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Зберегти</button>' +
            '    </div>' +
            '  </footer>' +
            '</form>';

        try {
            if (overlay && overlay.parentNode) overlay.parentNode.replaceChild(root, overlay);
            else document.body.appendChild(root);
        } catch (_) {
            try { document.body.appendChild(root); } catch (__e) { /* no-op */ }
        }
        return root;
    }

    function __loadScriptOnceForJournal(src) {
        return new Promise(function (resolve) {
            try {
                if (document.querySelector('script[data-journal-src=\"' + src + '\"]')) return resolve();
                var s = document.createElement('script');
                s.src = src;
                s.defer = true;
                s.async = false;
                s.setAttribute('data-journal-src', src);
                s.onload = function () { resolve(); };
                s.onerror = function () { resolve(); };
                document.head.appendChild(s);
            } catch (_) { resolve(); }
        });
    }

    function __ensureCalendarUiForJournal() {
        if (__journalCalUiPromise) return __journalCalUiPromise;

        // If calendar UI already present (e.g., shared bundle), just ensure overlays & return.
        try {
            if (window.CalendarApp && window.CalendarApp.ui && typeof window.CalendarApp.ui.openInfo === 'function') {
                __ensureIconsCssForJournalDialogs();
                __ensurePlanningTodayElForJournal();
                __ensureInfoOverlayFullForJournal();
                __ensureEditOverlayFullForJournal();
                __journalCalUiPromise = Promise.resolve(true);
                return __journalCalUiPromise;
            }
        } catch (_) { /* continue */ }

        __journalCalUiPromise = __ensureMeUserIdForJournal().then(function () {
            __ensureIconsCssForJournalDialogs();
            __ensureInfoOverlayFullForJournal();
            __ensureEditOverlayFullForJournal();

            // Load only what modals need (events + data + modals).
            return __loadScriptOnceForJournal('/assets/js/calendar/calendar.events.js')
                .then(function () { return __loadScriptOnceForJournal('/assets/js/calendar/calendar.data.js'); })
                .then(function () { return __loadScriptOnceForJournal('/assets/js/calendar/calendar.ui.modals.js'); })
                .then(function () { return true; });
        });

        return __journalCalUiPromise;
    }

    function __seedEventIntoCalendarCacheForJournal(ev, dateISO, id) {
        try {
            if (!window.CalendarApp || !window.CalendarApp.data) return;
            var Data = window.CalendarApp.data;
            if (!Data || typeof Data._getCache !== 'function' || typeof Data._setCache !== 'function' || typeof Data.getEventsFor !== 'function') return;

            var arr = Data.getEventsFor(dateISO) || [];
            var exists = false;
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && String(arr[i].id || '') === String(id)) { exists = true; break; }
            }
            if (exists) return;

            var store = (typeof Data._getCache === 'function') ? (Data._getCache() || {}) : {};
            if (!store[dateISO] || !Array.isArray(store[dateISO])) store[dateISO] = [];

            var copy = {};
            try { copy = JSON.parse(JSON.stringify(ev || {})); } catch (_) { copy = ev || {}; }
            if (!copy.id) copy.id = String(id || '');
            if (!copy.start_date) copy.start_date = String(dateISO || '');
            if (!copy.date) copy.date = String(dateISO || '');

            store[dateISO].push(copy);
            Data._setCache(store);
        } catch (_) { /* no-op */ }
    }


    function __journalFixEditBtnFirstOpen(dateISO, id, ev) {
        try {
            var didRetry = false;

            function isEditHidden() {
                var btn = document.getElementById('editEvBtn');
                if (!btn) return true;
                try {
                    if (btn.hidden) return true;
                    if (btn.hasAttribute && btn.hasAttribute('hidden')) return true;
                    if (btn.getAttribute && String(btn.getAttribute('aria-hidden') || '') === 'true') return true;
                    // If the button is in DOM but not visible due to CSS
                    var cs = window.getComputedStyle ? window.getComputedStyle(btn) : null;
                    if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')) return true;
                } catch (_) { return true; }
                return false;
            }

            function retryOnce() {
                if (didRetry) return;
                didRetry = true;
                try { if (ev) __seedEventIntoCalendarCacheForJournal(ev, dateISO, id); } catch (_) { }
                try {
                    if (window.CalendarApp && window.CalendarApp.ui && typeof window.CalendarApp.ui.openInfo === 'function') {
                        window.CalendarApp.ui.openInfo(dateISO, id);
                    }
                } catch (_) { /* no-op */ }
            }

            // Small delay: on first open, UI scripts may still finish init/bindings.
            window.setTimeout(function () {
                try {
                    var ov = document.getElementById('infoOverlay');
                    var shown = !!(ov && ov.classList && ov.classList.contains('show'));
                    if (!shown) return;
                    if (isEditHidden()) retryOnce();
                } catch (_) { /* no-op */ }
            }, 180);

            // One more delayed check (still only one retry total).
            window.setTimeout(function () {
                try {
                    var ov = document.getElementById('infoOverlay');
                    var shown = !!(ov && ov.classList && ov.classList.contains('show'));
                    if (!shown) return;
                    if (isEditHidden()) retryOnce();
                } catch (_) { /* no-op */ }
            }, 420);

        } catch (_) { /* no-op */ }
    }

    function openEventDetailsFullFromJournal(ev, it) {
        if (!ev) return;

        var dateISO = (ev && (ev.start_date || ev.date)) ? String(ev.start_date || ev.date) : ((it && it.date) ? String(it.date) : '');
        var id = (ev && ev.id) ? String(ev.id) : ((it && it.entity_id) ? String(it.entity_id) : '');
        if (!dateISO || !id) return;

        __ensureCalendarUiForJournal().then(function () {
            try { __seedEventIntoCalendarCacheForJournal(ev, dateISO, id); } catch (_) { }

            try {
                if (window.CalendarApp && window.CalendarApp.ui && typeof window.CalendarApp.ui.openInfo === 'function') {
                    window.CalendarApp.ui.openInfo(dateISO, id);
                    try { __journalFixEditBtnFirstOpen(dateISO, id, ev); } catch (_) { }
                    return;
                }
            } catch (_) { /* fallback below */ }

            // Fallback (should not happen): open legacy info modal.
            try { openEventModal(ev, it); } catch (_) { }
        });
    }
    function openInfoEventDetails(ev, it) {
        try { openEventDetailsFullFromJournal(ev, it); return; } catch (_) { /* fallback below */ }
        if (!ev) return;

        var dateISO = (it && it.date) ? String(it.date) : (ev.start_date || ev.date ? String(ev.start_date || ev.date) : '');
        var id = (it && it.entity_id) ? String(it.entity_id) : (ev.id ? String(ev.id) : '');

        // Prefer native Calendar/Planning implementation if it can open (it will build UI itself).
        try {
            if (window && window.CalendarApp && window.CalendarApp.ui && typeof window.CalendarApp.ui.openInfo === 'function' && dateISO && id) {
                window.CalendarApp.ui.openInfo(dateISO, id);
                var ov = document.getElementById('infoOverlay');
                if (ov && ov.classList && ov.classList.contains('show')) return;
            }
        } catch (_) { /* fallback below */ }

        var overlay = document.getElementById('infoOverlay');
        var content = document.getElementById('infoContent');
        if (!overlay || !content) {
            // [DEFERRED] Legacy fallback (do not delete): Journal-built modal.
            if (false) {
                try { openEventModal(ev, it); } catch (_) { }
                return;
            }
            overlay = ensureInfoOverlayModal() || document.getElementById('infoOverlay');
            content = document.getElementById('infoContent');
        }
        if (!overlay || !content) return;

        ensureInfoOverlayHandlers();

        var locale = 'uk-UA';
        var weekday = '';
        try {
            var a = String(dateISO || '').split('-').map(Number);
            if (a.length === 3 && a[0] > 0) {
                weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(Date.UTC(a[0], a[1] - 1, a[2])));
            }
        } catch (_) { }

        function fmtISO(iso) {
            try {
                if (window && window.CalendarApp && window.CalendarApp.events && typeof window.CalendarApp.events.formatISO === 'function') {
                    return window.CalendarApp.events.formatISO(iso);
                }
            } catch (_) { }
            return String(iso || '');
        }
        function labelType(t) {
            try {
                if (window && window.CalendarApp && window.CalendarApp.events && typeof window.CalendarApp.events.labelForType === 'function') {
                    return window.CalendarApp.events.labelForType(t);
                }
            } catch (_) { }
            return String(t || '');
        }
        function asBool(v) {
            return (v === true || String(v) === '1' || String(v).toLowerCase() === 'true');
        }

        var startISO = String(ev.start_date || dateISO || '');
        var endISO = String(ev.end_date || '');
        var endBlock = '';
        if (endISO) {
            try {
                var dsA = startISO.split('-').map(Number);
                var deA = endISO.split('-').map(Number);
                if (dsA.length === 3 && deA.length === 3) {
                    var ds = new Date(Date.UTC(dsA[0], dsA[1] - 1, dsA[2]));
                    var de = new Date(Date.UTC(deA[0], deA[1] - 1, deA[2]));
                    var days = Math.round((de - ds) / 86400000) + 1;
                    if (!isNaN(days) && days > 0) {
                        endBlock = '<div><strong>Дата завершення:</strong> ' + esc(fmtISO(endISO)) + ' (' + esc(String(days)) + ' дн.)</div>';
                    } else {
                        endBlock = '<div><strong>Дата завершення:</strong> ' + esc(fmtISO(endISO)) + '</div>';
                    }
                } else {
                    endBlock = '<div><strong>Дата завершення:</strong> ' + esc(fmtISO(endISO)) + '</div>';
                }
            } catch (_) {
                endBlock = '<div><strong>Дата завершення:</strong> ' + esc(fmtISO(endISO)) + '</div>';
            }
        }

        var uid = 0;
        try { uid = parseInt(ev.user_id || 0, 10) || 0; } catch (_) { uid = 0; }

        var createdText = '—';
        try {
            if (ev.created_at) createdText = new Date(ev.created_at).toLocaleString(locale, { hour12: false });
        } catch (_) { }

        var html = '' +
            '<div class="row">' +
            '<div><strong>Дата:</strong> ' + esc(fmtISO(dateISO || startISO)) + (weekday ? (' (' + esc(weekday) + ')') : '') + '</div>' +
            endBlock +
            '<div><strong>Час:</strong> ' + esc(ev.time || '') + '</div>' +
            '</div>' +
            '<div class="row">' +
            '<div><strong>Тип:</strong> ' + esc(labelType(ev.type)) + '</div>' +
            '<div><strong>Виконана:</strong> ' + (asBool(ev.done) ? 'так' : 'ні') + '</div>' +
            '</div>' +
            '<div><strong>Назва:</strong> ' + esc(ev.title || '') + '</div>' +
            '<div><strong>Відповідальний:</strong> ' + esc(ev.owner || '—') + '</div>' +
            '<div><strong>Власник (створив):</strong> ' + (uid > 0 ? ('<span class="user--name" data-user-id="' + escAttr(String(uid)) + '"></span>') : '—') + '</div>' +
            '<div><strong>Створено:</strong> ' + esc(createdText) + '</div>' +
            '<div><strong>Терміновість:</strong> ' + (asBool(ev.urgent) ? 'так' : 'ні') + '</div>' +
            (ev.incoming_no ? '<div><strong>Вхідний №:</strong> ' + esc(String(ev.incoming_no || '—')) + '</div>' : '') +
            (ev.outgoing_no ? '<div><strong>Вихідний №:</strong> ' + esc(String(ev.outgoing_no || '—')) + '</div>' : '') +
            (ev.description ? ('<div><strong>Опис:</strong><br><div class="container auto">' + esc(String(ev.description || '')) + '</div></div>') : '');

        content.innerHTML = html;
        setInfoModalTypeForJournal(ev.type);

        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.removeAttribute('inert');
    }
    function tryOpenEventPopup(ev, it) {
        // Try to use the calendar's existing popup (if present), otherwise fallback to the built-in modal.
        try {
            // Preferred: open the same "Info" modal as in Calendar (if available and event is in the store).
            if (window && window.CalendarApp && window.CalendarApp.ui && typeof window.CalendarApp.ui.openInfo === 'function') {
                var d = (it && it.date) ? String(it.date) : (ev && (ev.start_date || ev.date) ? String(ev.start_date || ev.date) : '');
                var id = (it && it.entity_id) ? String(it.entity_id) : (ev && ev.id ? String(ev.id) : '');
                if (d && id && window.CalendarApp.data && typeof window.CalendarApp.data.getEventsFor === 'function') {
                    var arr = window.CalendarApp.data.getEventsFor(d) || [];
                    var found = false;
                    for (var i = 0; i < arr.length; i++) {
                        if (arr[i] && String(arr[i].id) === id) { found = true; break; }
                    }
                    if (found) { window.CalendarApp.ui.openInfo(d, id); return; }
                }
            }
        } catch (e0) { /* no-op */ }
        try {
            if (window && window.CalendarUI && typeof window.CalendarUI.openEventModal === 'function') {
                window.CalendarUI.openEventModal(ev);
                return;
            }
        } catch (e) { /* no-op */ }
        try {
            if (window && typeof window.openEventModal === 'function') {
                window.openEventModal(ev);
                return;
            }
        } catch (e2) { /* no-op */ }

        openEventModal(ev, it);
    }

    function ensureAuditModal() {
        if (document.getElementById('audit-modal')) return;
        var root = document.createElement('div');
        root.id = 'audit-modal';
        root.className = 'audit-modal';
        root.innerHTML =
            '<div class="audit-modal__backdrop" data-close="1"></div>' +
            '<div class="audit-modal__panel" role="dialog" aria-modal="true" aria-label="Деталі події">' +
            '  <div class="audit-modal__head">' +
            '    <div class="audit-modal__title">Деталі події</div>' +
            '    <button type="button" class="audit-modal__close" data-close="1">✕</button>' +
            '  </div>' +
            '  <div class="audit-modal__body" id="audit-modal-body"></div>' +
            '</div>';
        document.body.appendChild(root);
        root.addEventListener('click', function (e) {
            var t = e.target;
            if (t && t.getAttribute && t.getAttribute('data-close') === '1') closeAuditModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeAuditModal();
        });
    }

    function openAuditModal(it) {
        ensureAuditModal();
        var root = document.getElementById('audit-modal');
        var body = document.getElementById('audit-modal-body');
        if (!root || !body) return;

        var sum = buildHumanSummary(it);
        var ts = formatTs(it.ts || '');
        var action = uaActionLabel(it.action || '');
        var author = (it.user_name || '—').toString();
        var ip = (it.ip || '—').toString();
        var ua = (it.ua || '').toString();

        var ev = pickEventSnapshot(it);
        var evWhen = formatEventWhen(ev) || (it.date ? String(it.date) : '');

        var diff = [];
        if ((it.action || '') === 'cabinet.admin_user_update') {
            diff = diffUser(it.user_before, it.user_after);
        } else {
            diff = diffEvent(it.event_before, it.event_after);
        }

        body.innerHTML = '';
        var top = document.createElement('div');
        top.className = 'audit-modal__grid';
        top.innerHTML =
            '<div class="audit-k">Подія</div><div class="audit-v">' + esc(sum.title) + '</div>' +
            (sum.sub ? '<div class="audit-k">Деталі</div><div class="audit-v">' + esc(sum.sub) + '</div>' : '') +
            '<div class="audit-k">Час</div><div class="audit-v">' + esc(ts) + '</div>' +
            '<div class="audit-k">Тип</div><div class="audit-v">' + esc(action) + '</div>' +
            '<div class="audit-k">Автор</div><div class="audit-v"><span class="audit-author">' + esc(author) + '</span></div>' +
            '<div class="audit-k">Статус</div><div class="audit-v">' + esc((it.result || '—').toString()) + '</div>' +
            (evWhen ? '<div class="audit-k">Коли</div><div class="audit-v">' + esc(evWhen) + '</div>' : '') +
            (it.entity_type ? '<div class="audit-k">Сутність</div><div class="audit-v">' + esc(String(it.entity_type)) + '#' + esc(String(it.entity_id || '')) + '</div>' : '') +
            '<div class="audit-k">IP</div><div class="audit-v">' + esc(ip) + '</div>' +
            (ua ? '<div class="audit-k">User-Agent</div><div class="audit-v">' + esc(ua) + '</div>' : '');
        body.appendChild(top);

        if (diff && diff.length) {
            var box = document.createElement('div');
            box.className = 'audit-diff';
            var html = '<table><thead><tr><th>Поле</th><th>Було</th><th>Стало</th></tr></thead><tbody>';
            diff.forEach(function (c) {
                html += '<tr><td>' + esc(c.label) + '</td><td>' + esc(c.from) + '</td><td>' + esc(c.to) + '</td></tr>';
            });
            html += '</tbody></table>';
            box.innerHTML = html;
            body.appendChild(box);
        }

        var raw = document.createElement('div');
        raw.className = 'audit-raw';
        raw.innerHTML = '<details><summary>Сирі дані (JSON)</summary><pre>' + esc(JSON.stringify(it, null, 2)) + '</pre></details>';
        body.appendChild(raw);

        root.classList.add('is-open');
    }

    function closeAuditModal() {
        var root = document.getElementById('audit-modal');
        if (!root) return;
        root.classList.remove('is-open');
        var body = document.getElementById('audit-modal-body');
        if (body) body.innerHTML = '';
    }
})();
