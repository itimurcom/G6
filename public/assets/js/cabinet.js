// Tabs controller — ADD ONLY (with localStorage persistence)
(function () {
    var STORAGE_KEY = 'cabinet:lastTab';
    var tabs = document.querySelectorAll('.legend .lg');

    function setTab(name) {
        tabs.forEach(function (t) {
            t.style.cursor = 'pointer';
            t.classList.toggle('is-active', t.dataset.tab === name);
        });
        var cards = document.querySelectorAll('.cabinet-tab');
        cards.forEach(function (el) {
            var tab = el.getAttribute('data-tab') || 'profile';
            el.style.display = (tab === name) ? '' : 'none';
        });
        // persist selected tab
        try { localStorage.setItem(STORAGE_KEY, name); } catch (e) { /* no-op */ }
    }

    // click -> switch + persist
    tabs.forEach(function (t) {
        t.addEventListener('click', function () { setTab(t.dataset.tab); });
    });

    // restore last tab or fallback to the first available / 'profile'
    var defaultTab = tabs.length ? (tabs[0].dataset.tab || 'profile') : 'profile';
    var allowed = Array.prototype.map.call(tabs, function (t) { return t.dataset.tab; });

    function getDeepLinkTab() {
        try {
            var u = new URL(window.location.href);
            var q = (u.searchParams.get('tab') || '').toLowerCase();
            if (q && allowed.indexOf(q) !== -1) return q;
        } catch (e) { /* no-op */ }

        try {
            var h = (window.location.hash || '').replace(/^#/, '').toLowerCase();
            if (!h) return null;
            if (h.indexOf('tab=') === 0) h = h.slice(4);
            if (h && allowed.indexOf(h) !== -1) return h;
        } catch (e2) { /* no-op */ }

        return null;
    }

    function clearDeepLinkTab() {
        try {
            var u = new URL(window.location.href);
            var changed = false;
            if (u.searchParams.has('tab')) {
                u.searchParams.delete('tab');
                changed = true;
            }
            var h = (u.hash || '').replace(/^#/, '').toLowerCase();
            if (h === 'settings' || h === 'security' || h === 'users' || h === 'files' || h === 'journal' || h.indexOf('tab=') === 0) {
                u.hash = '';
                changed = true;
            }
            if (!changed) return;
            var next = u.pathname + (u.searchParams.toString() ? ('?' + u.searchParams.toString()) : '') + (u.hash || '');
            window.history.replaceState(window.history.state || {}, document.title, next);
        } catch (e) { /* no-op */ }
    }

    var initialTab = defaultTab;
    // P15.9: deep-link tab via ?tab=settings or #settings (priority over saved)
    var deep = getDeepLinkTab();
    if (deep) {
        initialTab = deep;
    } else {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved && allowed.indexOf(saved) !== -1) {
                initialTab = saved;
            }
        } catch (e) { /* no-op */ }
    }

    setTab(initialTab);
    clearDeepLinkTab();
})();



// Cabinet Settings: Theme toggle (ui-theme) — ADD ONLY
(function () {
    var KEY = 'ui-theme';
    var el = document.getElementById('uiThemeToggle');
    if (!el) return;

    function prefersDark() {
        try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
        catch (e) { return false; }
    }
    function read() {
        try { return localStorage.getItem(KEY) || (prefersDark() ? 'dark' : 'light'); }
        catch (e) { return (prefersDark() ? 'dark' : 'light'); }
    }
    function write(v) {
        try { localStorage.setItem(KEY, v); } catch (e) { /* no-op */ }
    }
    function apply(v) {
        var theme = (v === 'dark') ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);

        // If app.js FAB exists, it will update icon via click handler; we don't rely on internals.
        // Keep checkbox in sync:
        el.checked = (theme === 'dark');
    }

    // init
    apply(read());

    // user change
    el.addEventListener('change', function () {
        var next = el.checked ? 'dark' : 'light';
        write(next);
        apply(next);
    });
})();



// Cabinet Settings: Font scale (ui-font-scale) — ADD ONLY
(function () {
    var KEY = 'ui-font-scale';
    var buttons = document.querySelectorAll('[data-font-scale]');
    if (!buttons || !buttons.length) return;

    function read() {
        try { return localStorage.getItem(KEY) || '1'; }
        catch (e) { return '1'; }
    }
    function write(v) {
        try { localStorage.setItem(KEY, v); } catch (e) { /* no-op */ }
    }
    function apply(v) {
        var allowed = ['0.75','1','1.25','1.5'];
        var val = (allowed.indexOf(String(v)) !== -1) ? String(v) : '1';
        document.documentElement.style.setProperty('--font-scale', val);
        buttons.forEach(function (b) {
            b.classList.toggle('is-active', String(b.dataset.fontScale) === val);
        });
    }

    // init
    apply(read());

    // click
    buttons.forEach(function (b) {
        b.addEventListener('click', function () {
            var v = String(b.dataset.fontScale || '1');
            write(v);
            apply(v);
        });
    });
})();


// Cabinet Settings: Font family (ui-font-family) — ADD ONLY
(function () {
    var KEY = 'ui-font-family';
    var buttons = document.querySelectorAll('[data-font-family]');
    if (!buttons || !buttons.length) return;

    function normalize(v) {
        v = String(v || '').toLowerCase().trim();
        return (['inter','sfpro','arial'].indexOf(v) !== -1) ? v : 'inter';
    }
    function read() {
        try { return normalize(localStorage.getItem(KEY) || 'inter'); }
        catch (e) { return 'inter'; }
    }
    function write(v) {
        try { localStorage.setItem(KEY, normalize(v)); } catch (e) { /* no-op */ }
    }
    function apply(v) {
        var val = normalize(v);
        document.documentElement.setAttribute('data-ui-font', val);
        buttons.forEach(function (b) {
            b.classList.toggle('is-active', String(b.dataset.fontFamily || '') === val);
        });
        try {
            window.dispatchEvent(new CustomEvent('uifontchange', { detail: { font: val } }));
        } catch (e) { /* no-op */ }
    }

    apply(read());

    buttons.forEach(function (b) {
        b.addEventListener('click', function () {
            var v = String(b.dataset.fontFamily || 'inter');
            write(v);
            apply(v);
        });
    });
})();


// Cabinet Settings: Max file size for uploads in comments (GLOBAL, server-side) — ADD ONLY
(function () {
    var input = document.getElementById("uiMaxFileMb");
    if (!input) return; // Visible only for admin

    var btn = document.getElementById("uiMaxFileMbSave");
    var status = document.getElementById("uiMaxFileMbStatus");

    var def = 100;
    var lastSaved = null;
    var inFlight = false;

    function clamp(n) {
        n = parseInt(n || 0, 10) || def;
        if (n < 1) n = 1;
        if (n > 1024) n = 1024;
        return n;
    }

    function csrfToken() {
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? (meta.getAttribute("content") || "") : "";
    }

    function toast(msg, kind, ms) {
        if (window.UiToast && typeof window.UiToast.show === "function") {
            window.UiToast.show(String(msg || ""), String(kind || "info"), ms || 1800);
        }
    }

    function setStatus(text) {
        if (!status) return;
        status.textContent = String(text || "");
    }

    function setValue(v) {
        input.value = String(clamp(v));
    }

    function setDirty(isDirty) {
        if (btn) btn.disabled = !isDirty;
        if (isDirty) setStatus("Не збережено");
    }

    function markSaved(v) {
        lastSaved = clamp(v);
        setDirty(false);
        setStatus("Збережено");
    }

    function load() {
        fetch("/api/settings/upload", { method: "GET", credentials: "same-origin" })
            .then(function (r) { return r.json ? r.json() : null; })
            .then(function (j) {
                if (!j || !j.ok || !j.upload) return;
                setValue(j.upload.max_file_mb);
                markSaved(j.upload.max_file_mb);
            })
            .catch(function () {
                // keep current value
                var cur = clamp(input.value);
                setValue(cur);
                markSaved(cur);
            });
    }

    function save(v) {
        if (inFlight) return;
        var max = clamp(v);
        inFlight = true;
        setStatus("Збереження…");
        if (btn) btn.disabled = true;

        var body = new FormData();
        body.append("_csrf", csrfToken());
        body.append("max_file_mb", String(max));

        fetch("/api/settings/upload", { method: "POST", credentials: "same-origin", body: body })
            .then(function (r) { return r.json ? r.json() : null; })
            .then(function (j) {
                inFlight = false;
                if (!j) {
                    setStatus("Помилка збереження");
                    setDirty(true);
                    return;
                }
                if (j.ok && j.upload) {
                    setValue(j.upload.max_file_mb);
                    markSaved(j.upload.max_file_mb);
                    toast("Збережено: максимум " + String(j.upload.max_file_mb) + " MB", "success", 1200);
                    try {
                        window.__APP_SETTINGS = window.__APP_SETTINGS || {};
                        window.__APP_SETTINGS.upload = window.__APP_SETTINGS.upload || {};
                        window.__APP_SETTINGS.upload.max_file_mb = j.upload.max_file_mb;
                    } catch (e) { /* no-op */ }
                } else {
                    setStatus("Не вдалося зберегти");
                    setDirty(true);
                    toast("Не вдалося зберегти налаштування", "error", 2200);
                }
            })
            .catch(function () {
                inFlight = false;
                setStatus("Не вдалося зберегти");
                setDirty(true);
                toast("Не вдалося зберегти налаштування", "error", 2200);
            });
    }

    function isDirty() {
        if (lastSaved === null) return true;
        return clamp(input.value) !== lastSaved;
    }

    // init from server (and keep current value if request fails)
    load();

    // UX: explicit save button + Enter
    if (btn) {
        btn.addEventListener("click", function () {
            if (!isDirty()) return;
            save(input.value);
        });
    }

    input.addEventListener("input", function () {
        setDirty(isDirty());
    });

    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            if (isDirty()) save(input.value);
        }
    });
})();
;


// P15.7: cabinet toast payload (password change success)
(function () {
    var el = document.getElementById('cabinetToastPayload');
    if (!el) return;

    var kind = (el.getAttribute('data-kind') || 'info').toLowerCase();
    var msg = el.getAttribute('data-message') || '';
    if (!msg) return;

    if (window.UiToast && typeof window.UiToast.show === 'function') {
        var ms = (kind === 'success') ? 1200 : 1800;
        window.UiToast.show(msg, kind, ms);
    }
})();



// P15.12: cabinet toast payloads (admin user update)
(function () {
    var ids = ['cabinetToastPayloadAdmin', 'cabinetToastPayloadAdminErr'];
    ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;

        var kind = (el.getAttribute('data-kind') || 'info').toLowerCase();
        var msg = el.getAttribute('data-message') || '';
        if (!msg) return;

        if (window.UiToast && typeof window.UiToast.show === 'function') {
            var ms = (kind === 'success') ? 1200 : 2200;
            window.UiToast.show(msg, kind, ms);
        }
    });
})();

// P15.12: Admin Users — edit modal (Cabinet > Users)
(function () {
    var modal = document.getElementById('adminUserModal');
    if (!modal) return;

    var idEl = document.getElementById('adminUserId');
    var idViewEl = document.getElementById('adminUserIdView');
    var nameEl = document.getElementById('adminUserName');
    var loginEl = document.getElementById('adminUserLogin');
    var emailEl = document.getElementById('adminUserEmail');
    var roleEl = document.getElementById('adminUserRole');
    var isAdminEl = document.getElementById('adminUserIsAdmin');
    var createdEl = document.getElementById('adminUserCreated');
    var updatedEl = document.getElementById('adminUserUpdated');

    function ensureRoleOption(value) {
        if (!roleEl) return;
        var v = String(value || '').trim();
        if (!v) v = 'user';
        var found = false;
        for (var i = 0; i < roleEl.options.length; i++) {
            if (String(roleEl.options[i].value) === v) { found = true; break; }
        }
        if (!found) {
            var opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            roleEl.insertBefore(opt, roleEl.firstChild);
        }
        roleEl.value = v;
    }

    function openModal(user) {
        try { document.body.classList.add('cab-modal-open'); } catch (e) { /* no-op */ }
        modal.hidden = false;

        if (idEl) idEl.value = String(user.id || '');
        if (idViewEl) idViewEl.textContent = String(user.id || "—");
        if (nameEl) nameEl.value = String(user.name || '');
        if (loginEl) loginEl.value = String(user.login || '');
        if (emailEl) emailEl.value = String(user.email || '');
        ensureRoleOption(user.role || 'user');
        if (isAdminEl) isAdminEl.checked = !!(user.is_admin && String(user.is_admin) !== '0');
        if (createdEl) createdEl.textContent = String(user.created_at || "—");
        if (updatedEl) updatedEl.textContent = String(user.updated_at || "—");

        // focus first editable field
        setTimeout(function () {
            try { if (nameEl) nameEl.focus(); } catch (e) { /* no-op */ }
        }, 0);
    }

    function closeModal() {
        modal.hidden = true;
        try { document.body.classList.remove('cab-modal-open'); } catch (e) { /* no-op */ }
    }

    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.js-user-edit') : null;
        if (btn) {
            e.preventDefault();
            var raw = btn.getAttribute('data-user') || '';
            if (!raw) return;
            var user = null;
            try { user = JSON.parse(raw); } catch (err) { user = null; }
            if (!user) return;
            openModal(user);
            return;
        }

        var closeBtn = e.target && e.target.closest ? e.target.closest('[data-close="1"]') : null;
        if (closeBtn && closeBtn.closest && closeBtn.closest('#adminUserModal')) {
            e.preventDefault();
            closeModal();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && !modal.hidden) {
            closeModal();
        }
    });
})();

// P15.15: Admin Users — password modal (Cabinet > Users)
(function () {
    var modal = document.getElementById('adminUserPassModal');
    if (!modal) return;

    var idEl = document.getElementById('adminUserPassId');
    var userEl = document.getElementById('adminUserPassUser');
    var passEl = document.getElementById('adminUserPassNew');

    function openModal(user) {
        try { document.body.classList.add('cab-modal-open'); } catch (e) { /* no-op */ }
        modal.hidden = false;

        var id = String(user.id || '');
        var login = String(user.login || '');
        var name = String(user.name || '');

        if (idEl) idEl.value = id;
        if (userEl) {
            var label = '';
            if (login) label += login;
            if (name) label += (label ? ' — ' : '') + name;
            if (!label) label = 'ID ' + (id || '—');
            else label += ' (ID ' + (id || '—') + ')';
            userEl.textContent = label;
        }

        if (passEl) passEl.value = '';

        setTimeout(function () {
            try { if (passEl) passEl.focus(); } catch (e) { /* no-op */ }
        }, 0);
    }

    function closeModal() {
        modal.hidden = true;
        try { document.body.classList.remove('cab-modal-open'); } catch (e) { /* no-op */ }
        if (passEl) passEl.value = '';
    }

    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.js-user-pass') : null;
        if (btn) {
            e.preventDefault();
            var raw = btn.getAttribute('data-user') || '';
            if (!raw) return;
            var user = null;
            try { user = JSON.parse(raw); } catch (err) { user = null; }
            if (!user) return;
            openModal(user);
            return;
        }

        var closeBtn = e.target && e.target.closest ? e.target.closest('[data-close="1"]') : null;
        if (closeBtn && closeBtn.closest && closeBtn.closest('#adminUserPassModal')) {
            e.preventDefault();
            closeModal();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && !modal.hidden) {
            closeModal();
        }
    });
})();




// P17.0: Cabinet profile avatar direct upload/delete
(function () {
    var input = document.getElementById('cabAvatarInput');
    var preview = document.getElementById('cabAvatarPreview');
    var uploadForm = document.getElementById('cabAvatarUploadForm');
    var img = document.getElementById('cabAvatarImg');
    var initials = document.getElementById('cabAvatarInitials');
    var deleteForm = document.getElementById('cabAvatarDeleteForm');
    if (!input || !preview || !uploadForm) return;

    function openPicker() {
        try { input.click(); } catch (e) { /* no-op */ }
    }

    function showInitialsFallback() {
        preview.classList.remove('has-image');
        if (img && img.parentNode) {
            img.parentNode.removeChild(img);
            img = null;
        }
        if (initials) {
            initials.hidden = false;
            if (!String(initials.textContent || '').trim()) {
                initials.textContent = String(preview.getAttribute('data-initials') || '??');
            }
        }
        if (deleteForm && deleteForm.parentNode) {
            deleteForm.parentNode.removeChild(deleteForm);
            deleteForm = null;
        }
    }

    preview.addEventListener('click', function (e) {
        e.preventDefault();
        openPicker();
    });

    preview.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
        }
    });

    if (img) {
        img.addEventListener('error', function () {
            showInitialsFallback();
        }, { once: true });
    }

    input.addEventListener('change', function () {
        var file = input.files && input.files[0] ? input.files[0] : null;
        if (!file) return;
        uploadForm.submit();
    });
})();


// Cabinet Files tab — P3 add-only
(function () {
    var root = document.getElementById('cabFilesRoot');
    if (!root) return;

    var tbody = document.getElementById('cabFilesTbody');
    var counter = document.getElementById('cabFilesCounter');
    var status = document.getElementById('cabFilesStatus');
    var searchInput = document.getElementById('cabFilesSearch');
    var typeSelect = document.getElementById('cabFilesType');
    var sortSelect = document.getElementById('cabFilesSort');
    var applyBtn = document.getElementById('cabFilesApply');
    var refreshBtn = document.getElementById('cabFilesRefresh');
    var prevBtn = document.getElementById('cabFilesPrev');
    var nextBtn = document.getElementById('cabFilesNext');
    var pageInfo = document.getElementById('cabFilesPageInfo');
    var scopeLabel = document.getElementById('cabFilesScopeLabel');
    var preview = document.getElementById('cabFilesPreview');
    var previewBody = document.getElementById('cabFilesPreviewBody');
    var previewTitle = document.getElementById('cabFilesPreviewTitle');
    var scopeButtons = root.querySelectorAll('[data-scope]');

    var isAdmin = String(root.getAttribute('data-is-admin') || '0') === '1';
    var defaultScope = String(root.getAttribute('data-default-scope') || (isAdmin ? 'all' : 'mine'));
    var state = {
        limit: 50,
        offset: 0,
        total: 0,
        q: '',
        type: 'all',
        sort: 'newest',
        scope: defaultScope,
        loaded: false,
        inFlight: false,
        endpointMissing: false
    };

    function csrfToken() {
        var token = String(root.getAttribute('data-csrf') || '');
        if (token) return token;
        var meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? String(meta.getAttribute('content') || '') : '';
    }

    function toast(msg, kind, ms) {
        if (window.UiToast && typeof window.UiToast.show === 'function') {
            window.UiToast.show(String(msg || ''), String(kind || 'info'), ms || 1800);
        }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatSize(bytes) {
        var value = parseInt(bytes || 0, 10) || 0;
        if (value <= 0) return '0 B';
        var units = ['B', 'KB', 'MB', 'GB', 'TB'];
        var idx = 0;
        while (value >= 1024 && idx < units.length - 1) {
            value = value / 1024;
            idx += 1;
        }
        return (idx === 0 ? String(Math.round(value)) : value.toFixed(value >= 10 ? 1 : 2)) + ' ' + units[idx];
    }

    function formatDateTime(value) {
        var raw = String(value || '').trim();
        if (!raw) return '—';
        var iso = raw.replace(' ', 'T');
        var date = new Date(iso);
        if (!isNaN(date.getTime())) {
            return date.toLocaleString('uk-UA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return raw;
    }

    function scopeTitle(scope) {
        return scope === 'all' ? 'Всі файли' : 'Мої файли';
    }

    function typeLabel(group) {
        switch (String(group || '')) {
            case 'image': return 'Зображення';
            case 'pdf': return 'PDF';
            case 'spreadsheet': return 'Таблиця';
            case 'archive': return 'Архів';
            default: return 'Документ';
        }
    }

    function canPreview(item) {
        if (!item) return false;
        var group = String(item.type_group || '');
        var mime = String(item.mime_type || '').toLowerCase();
        return group === 'image' || group === 'pdf' || mime.indexOf('text/') === 0;
    }

    function setStatus(text, kind) {
        if (!status) return;
        status.textContent = String(text || '');
        status.setAttribute('data-kind', String(kind || 'neutral'));
    }

    function setScope(scope) {
        state.scope = (!isAdmin ? 'mine' : (scope === 'mine' ? 'mine' : 'all'));
        Array.prototype.forEach.call(scopeButtons, function (btn) {
            btn.classList.toggle('is-active', String(btn.getAttribute('data-scope')) === state.scope);
        });
        if (scopeLabel) {
            scopeLabel.textContent = scopeTitle(state.scope);
        }
    }

    function updatePager() {
        if (counter) {
            if (!state.loaded) {
                counter.textContent = '—';
            } else if (state.total <= 0) {
                counter.textContent = '0 файлів';
            } else {
                var from = state.offset + 1;
                var to = Math.min(state.offset + state.limit, state.total);
                counter.textContent = from + '–' + to + ' із ' + state.total;
            }
        }
        if (pageInfo) {
            if (!state.loaded || state.total <= 0) {
                pageInfo.textContent = 'Сторінка —';
            } else {
                var currentPage = Math.floor(state.offset / state.limit) + 1;
                var totalPages = Math.max(1, Math.ceil(state.total / state.limit));
                pageInfo.textContent = 'Сторінка ' + currentPage + ' / ' + totalPages;
            }
        }
        if (prevBtn) prevBtn.disabled = state.offset <= 0 || state.inFlight;
        if (nextBtn) nextBtn.disabled = state.inFlight || (state.offset + state.limit >= state.total);
        if (applyBtn) applyBtn.disabled = state.inFlight;
        if (refreshBtn) refreshBtn.disabled = state.inFlight;
    }

    function renderEmpty(message) {
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" class="cab-files__empty">' + escapeHtml(message || 'Нічого не знайдено.') + '</td></tr>';
    }

    function renderRows(items) {
        if (!tbody) return;
        if (!items || !items.length) {
            renderEmpty('Файлів за поточним фільтром не знайдено.');
            return;
        }

        var html = items.map(function (item) {
            var title = String(item.original_name || 'document');
            var uploader = item.uploader && item.uploader.display ? String(item.uploader.display) : '—';
            var eventTitle = String(item.event_title || item.event_id || '—');
            var eventMeta = item.event_id ? '<div class="cab-files__eventId">' + escapeHtml(String(item.event_id)) + '</div>' : '';
            var typeGroup = String(item.type_group || 'other');
            var typeBadge = '<span class="cab-files__typeBadge is-' + escapeHtml(typeGroup) + '">' + escapeHtml(typeLabel(typeGroup)) + '</span>';
            var actions = '';
            if (canPreview(item)) {
                actions += '<button type="button" class="cab-files__action" data-action="preview" data-id="' + String(item.id || 0) + '">Попередній</button>';
            }
            actions += '<a class="cab-files__action" href="' + escapeHtml(String(item.view_url || '#')) + '" target="_blank" rel="noopener">Перегляд</a>';
            actions += '<a class="cab-files__action" href="' + escapeHtml(String(item.download_url || '#')) + '">Скачати</a>';
            actions += '<button type="button" class="cab-files__action is-danger" data-action="delete" data-id="' + String(item.id || 0) + '" data-name="' + escapeHtml(title) + '">Видалити</button>';

            return '' +
                '<tr data-id="' + String(item.id || 0) + '">' +
                    '<td class="cab-files__nameCell">' +
                        '<div class="cab-files__name">' + escapeHtml(title) + '</div>' +
                        '<div class="cab-files__mime">' + escapeHtml(String(item.mime_type || 'application/octet-stream')) + '</div>' +
                    '</td>' +
                    '<td>' + typeBadge + '</td>' +
                    '<td>' + escapeHtml(formatSize(item.file_size || 0)) + '</td>' +
                    '<td>' + escapeHtml(uploader) + '</td>' +
                    '<td><div class="cab-files__eventTitle">' + escapeHtml(eventTitle) + '</div>' + eventMeta + '</td>' +
                    '<td>' + escapeHtml(formatDateTime(item.created_at || '')) + '</td>' +
                    '<td><div class="cab-files__rowActions">' + actions + '</div></td>' +
                '</tr>';
        }).join('');
        tbody.innerHTML = html;
    }

    function openPreview(item) {
        if (!preview || !previewBody || !item) {
            if (item && item.view_url) window.open(item.view_url, '_blank', 'noopener');
            return;
        }
        var title = String(item.original_name || 'Попередній перегляд');
        var group = String(item.type_group || 'other');
        var mime = String(item.mime_type || '').toLowerCase();
        previewTitle.textContent = title;
        if (group === 'image') {
            previewBody.innerHTML = '<img class="cab-files__previewImage" src="' + escapeHtml(String(item.view_url || '#')) + '" alt="' + escapeHtml(title) + '">';
        } else if (group === 'pdf' || mime.indexOf('text/') === 0) {
            previewBody.innerHTML = '<iframe class="cab-files__previewFrame" src="' + escapeHtml(String(item.view_url || '#')) + '" title="' + escapeHtml(title) + '"></iframe>';
        } else {
            window.open(item.view_url, '_blank', 'noopener');
            return;
        }
        preview.hidden = false;
        document.body.classList.add('is-cab-files-preview-open');
    }

    function closePreview() {
        if (!preview) return;
        preview.hidden = true;
        if (previewBody) previewBody.innerHTML = '';
        document.body.classList.remove('is-cab-files-preview-open');
    }

    function buildUrl() {
        var params = new URLSearchParams();
        params.set('limit', String(state.limit));
        params.set('offset', String(state.offset));
        params.set('scope', String(state.scope));
        params.set('type', String(state.type));
        params.set('sort', String(state.sort));
        if (state.q) params.set('q', String(state.q));
        return '/api/documents/cabinet?' + params.toString();
    }

    function syncFromInputs(resetOffset) {
        state.q = String(searchInput && searchInput.value ? searchInput.value.trim() : '');
        state.type = String(typeSelect && typeSelect.value ? typeSelect.value : 'all');
        state.sort = String(sortSelect && sortSelect.value ? sortSelect.value : 'newest');
        if (resetOffset) state.offset = 0;
    }

    function loadList(resetOffset) {
        if (state.inFlight) return;
        if (resetOffset) state.offset = 0;
        syncFromInputs(false);
        state.inFlight = true;
        updatePager();
        setStatus('Завантаження списку файлів…', 'loading');

        fetch(buildUrl(), { method: 'GET', credentials: 'same-origin' })
            .then(function (response) {
                if (response.status === 404) {
                    state.endpointMissing = true;
                    throw { kind: 'missing-endpoint' };
                }
                if (!response.ok) {
                    throw { kind: 'http', status: response.status };
                }
                return response.json();
            })
            .then(function (payload) {
                if (!payload || !payload.ok) {
                    throw { kind: 'payload', payload: payload };
                }
                state.loaded = true;
                state.total = parseInt(payload.total || 0, 10) || 0;
                state.scope = String(payload.scope || state.scope);
                state.type = String(payload.type || state.type);
                state.sort = String(payload.sort || state.sort);
                setScope(state.scope);
                if (typeSelect) typeSelect.value = state.type;
                if (sortSelect) sortSelect.value = state.sort;
                renderRows(payload.items || []);
                setStatus(state.total > 0 ? 'Список оновлено.' : 'Файли не знайдено.', 'success');
            })
            .catch(function (error) {
                state.loaded = true;
                state.total = 0;
                if (error && error.kind === 'missing-endpoint') {
                    renderEmpty('P1 backend endpoint /api/documents/cabinet відсутній або не накочений.');
                    setStatus('Не знайдено backend endpoint /api/documents/cabinet.', 'error');
                    return;
                }
                renderEmpty('Не вдалося завантажити список файлів.');
                setStatus('Помилка завантаження списку файлів.', 'error');
            })
            .finally(function () {
                state.inFlight = false;
                updatePager();
            });
    }

    function deleteDocument(id, name) {
        if (!id) return;
        var label = String(name || 'цей файл');
        if (!window.confirm('Видалити файл "' + label + '"?')) {
            return;
        }
        setStatus('Видалення файла…', 'loading');
        fetch('/api/documents/delete', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, _csrf: csrfToken() })
        })
            .then(function (response) {
                return response.json().then(function (payload) {
                    return { ok: response.ok, payload: payload };
                }).catch(function () {
                    return { ok: response.ok, payload: null };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.payload || !result.payload.ok) {
                    throw result.payload || { error: 'delete_failed' };
                }
                toast('Файл видалено', 'success', 1400);
                loadList(false);
            })
            .catch(function (error) {
                var message = error && error.message ? error.message : 'Не вдалося видалити файл.';
                setStatus(message, 'error');
                toast(message, 'error', 2200);
            });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', function () {
            loadList(true);
        });
    }
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            loadList(false);
        });
    }
    if (searchInput) {
        searchInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                loadList(true);
            }
        });
    }
    if (typeSelect) {
        typeSelect.addEventListener('change', function () {
            loadList(true);
        });
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', function () {
            loadList(true);
        });
    }
    Array.prototype.forEach.call(scopeButtons, function (btn) {
        btn.addEventListener('click', function () {
            setScope(String(btn.getAttribute('data-scope') || 'mine'));
            loadList(true);
        });
    });
    if (prevBtn) {
        prevBtn.addEventListener('click', function () {
            if (state.offset <= 0) return;
            state.offset = Math.max(0, state.offset - state.limit);
            loadList(false);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', function () {
            if (state.offset + state.limit >= state.total) return;
            state.offset += state.limit;
            loadList(false);
        });
    }
    if (tbody) {
        tbody.addEventListener('click', function (event) {
            var target = event.target;
            if (!target) return;
            var action = target.getAttribute('data-action');
            if (!action) return;
            event.preventDefault();
            var tr = target.closest('tr');
            var id = parseInt(target.getAttribute('data-id') || (tr ? tr.getAttribute('data-id') : '0'), 10) || 0;
            if (!id) return;
            if (action === 'delete') {
                deleteDocument(id, target.getAttribute('data-name') || '');
                return;
            }
            if (action === 'preview') {
                var itemLink = tr ? tr.querySelector('a[href*="/api/documents/view?id="]') : null;
                var row = null;
                if (tr) {
                    row = {
                        id: id,
                        original_name: (tr.querySelector('.cab-files__name') || {}).textContent || '',
                        type_group: (tr.querySelector('.cab-files__typeBadge') || {}).className || '',
                        mime_type: (tr.querySelector('.cab-files__mime') || {}).textContent || '',
                        view_url: itemLink ? itemLink.getAttribute('href') : '/api/documents/view?id=' + id
                    };
                    if (row.type_group.indexOf('is-image') !== -1) row.type_group = 'image';
                    else if (row.type_group.indexOf('is-pdf') !== -1) row.type_group = 'pdf';
                    else if (row.type_group.indexOf('is-spreadsheet') !== -1) row.type_group = 'spreadsheet';
                    else if (row.type_group.indexOf('is-archive') !== -1) row.type_group = 'archive';
                    else row.type_group = 'other';
                }
                openPreview(row);
            }
        });
    }
    if (preview) {
        preview.addEventListener('click', function (event) {
            var target = event.target;
            if (target && target.getAttribute('data-close') === '1') {
                closePreview();
            }
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !preview.hidden) {
                closePreview();
            }
        });
    }

    setScope(state.scope);
    updatePager();
    loadList(true);
})();
