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
        var r = Array.prototype.slice.call(scopeRadios).find(function (r) { return r.checked; });
        return r ? r.value : 'me';
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
        return action || 'Подія';
    }

    function cssType(it) {
        if (it.action === 'auth.login') return 't-login';
        if (it.action === 'auth.logout') return 't-logout';
        if (it.action === 'calendar.event.create') return 't-create';
        if (it.action === 'calendar.event.update') return 't-update';
        if (it.action === 'calendar.event.delete') return 't-delete';
        if (it.action === 'calendar.event.done') return 't-update';
        if (it.action === 'calendar.event.urgent') return 't-update';
        return 't-other';
    }

    function pickEventSnapshot(it) {
        var after = it.event_after;
        var before = it.event_before;
        return (after && typeof after === 'object') ? after : ((before && typeof before === 'object') ? before : null);
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
        if (!before || !after) return changes;
        var fields = [
            ['title', 'Назва'],
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

    function buildHumanSummary(it) {
        var action = (it.action || '').toString();
        var label = uaActionLabel(action);
        var ev = pickEventSnapshot(it);
        var evTitle = (ev && ev.title) ? String(ev.title) : '';
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

        var title = label;
        if (action.indexOf('calendar.event.') === 0) {
            if (evTitle) title = label + ': «' + evTitle + '»';
            else if (it.entity_id) title = label + ': ' + String(it.entity_id);
        }

        var sub = '';
        if (action === 'auth.login' || action === 'auth.logout') {
            if (it.ip) sub = 'IP: ' + String(it.ip);
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

        if (!sub && evWhen) sub = 'Коли: ' + evWhen;
        if (!sub && it.message) sub = String(it.message);

        return { title: title, sub: sub };
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
        tdEv.innerHTML =
            '<div class="audit-ev-main">' + esc(summary.title) + '</div>' +
            (summary.sub ? '<div class="audit-ev-sub">' + esc(summary.sub) + '</div>' : '');

        var tdAu = document.createElement('td');
        tdAu.className = 'audit-col-author';
        tdAu.innerHTML = '<span class="audit-author" title="user_id: ' + escAttr(String(it.user_id || '')) + '">' + esc(author) + '</span>';

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
        tr.appendChild(tdAu);
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
            '<th class="audit-col-author">Автор</th>' +
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
            '#audit-block .audit-toolbar{flex-wrap:wrap;gap:10px}',
            '#audit-block #audit-q{flex:1;min-width:220px}',
            '#audit-block .audit-table-wrap{width:100%;overflow:auto;border:1px solid var(--border);border-radius:12px;background:var(--event-bg)}',
            '#audit-block .audit-table{width:100%;border-collapse:separate;border-spacing:0}',
            '#audit-block .audit-table th,#audit-block .audit-table td{padding:10px 12px;vertical-align:top;border-bottom:1px solid rgba(255,255,255,.06)}',
            ':root[data-theme="light"] #audit-block .audit-table th,:root[data-theme="light"] #audit-block .audit-table td{border-bottom:1px solid rgba(0,0,0,.06)}',
            '#audit-block .audit-table th{position:sticky;top:0;background:var(--event-bg);text-align:left;font-weight:700;z-index:1}',
            '#audit-block .audit-col-ts{white-space:nowrap;min-width:150px}',
            '#audit-block .audit-col-author{white-space:nowrap;min-width:120px}',
            '#audit-block .audit-col-result{white-space:nowrap;min-width:90px}',
            '#audit-block .audit-col-more{white-space:nowrap;min-width:90px}',
            '#audit-block .audit-ev-main{font-weight:700}',
            '#audit-block .audit-ev-sub{opacity:.78;font-size:12px;margin-top:2px}',
            '#audit-block .audit-author{color:#22c55e;font-weight:800}',
            '#audit-block .audit-result{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;font-size:12px;border:1px solid rgba(255,255,255,.10)}',
            ':root[data-theme="light"] #audit-block .audit-result{border:1px solid rgba(0,0,0,.10)}',
            '#audit-block .audit-result--success{background:rgba(34,197,94,.14)}',
            '#audit-block .audit-result--fail{background:rgba(239,68,68,.14)}',
            '#audit-block .audit-result--error{background:rgba(239,68,68,.14)}',
            '#audit-block .audit-link{color:var(--accent);text-decoration:none}',
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

        var diff = diffEvent(it.event_before, it.event_after);

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
