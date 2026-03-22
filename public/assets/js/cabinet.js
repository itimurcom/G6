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
    var preview = document.getElementById('cabFilesPreview');
    var previewBody = document.getElementById('cabFilesPreviewBody');
    var previewTitle = document.getElementById('cabFilesPreviewTitle');
    var previewMeta = document.getElementById('cabFilesPreviewMeta');
    var previewDownload = document.getElementById('cabFilesPreviewDownload');
    var previewFullscreen = document.getElementById('cabFilesPreviewFullscreen');
    var previewCloseBtn = document.getElementById('cabFilesPreviewClose');
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
        endpointMissing: false,
        preview: {
            open: false,
            fullscreen: false,
            requestKey: 0,
            item: null,
            kind: '',
            textLoading: false,
            textContent: ''
        }
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

    function typeIconMarkup(group) {
        var label = typeLabel(group);
        var icon = '';
        switch (String(group || '')) {
            case 'image':
                icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><path d="m7 16 3.2-3.2a1 1 0 0 1 1.4 0l1.8 1.8 1.4-1.4a1 1 0 0 1 1.4 0L17 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                break;
            case 'pdf':
                icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.75h6.5L18.25 8.5V19A1.25 1.25 0 0 1 17 20.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M13.5 3.75V8.5h4.75" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 15h1.4a1.3 1.3 0 1 0 0-2.6H8V17m4-4.6V17h1.1a1.8 1.8 0 0 0 0-3.6H12Zm5 0h-2v4.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                break;
            case 'spreadsheet':
                icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.75h6.5L18.25 8.5V19A1.25 1.25 0 0 1 17 20.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M13.5 3.75V8.5h4.75" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.25 11.5h7.5M8.25 15h7.5M10.75 10.25V17.5M13.25 10.25V17.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
                break;
            case 'archive':
                icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.75h10A1.25 1.25 0 0 1 18.25 6v2A1.25 1.25 0 0 1 17 9.25H7A1.25 1.25 0 0 1 5.75 8V6A1.25 1.25 0 0 1 7 4.75Zm0 4.5h10A1.25 1.25 0 0 1 18.25 10.5V18A1.25 1.25 0 0 1 17 19.25H7A1.25 1.25 0 0 1 5.75 18v-7.5A1.25 1.25 0 0 1 7 9.25Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 13h4m-3-6h2m-1 6v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
                break;
            default:
                icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.75h6.5L18.25 8.5V19A1.25 1.25 0 0 1 17 20.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M13.5 3.75V8.5h4.75" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 13.25h7M8.5 16.25h5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
                break;
        }
        return '<span class="cab-files__typeIcon is-' + escapeHtml(String(group || 'other')) + '" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">' + icon + '</span>';
    }

    function eventTypeClass(typeValue) {
        var type = String(typeValue || '').trim().toLowerCase();
        if (type === 'mi') return 'type-mi';
        if (type === 'nas') return 'type-nas';
        if (type === 'evt') return 'type-evt';
        return 'type-other';
    }

    function closeEventOverlay() {
        var overlay = document.getElementById('infoOverlay');
        if (!overlay) return;
        if (overlay.contains(document.activeElement)) {
            try { document.activeElement.blur(); } catch (_) { /* no-op */ }
        }
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('inert', '');
    }

    function eventInfoInitials(value) {
        var src = String(value || '').trim();
        if (!src) return '??';
        var parts = src.split(/\s+/).filter(Boolean);
        if (!parts.length) return '??';
        var first = Array.from(parts[0])[0] || '';
        var second = parts.length > 1 ? (Array.from(parts[1])[0] || '') : (Array.from(parts[0])[1] || '');
        return (first + second).toUpperCase() || '??';
    }

    function eventInfoDocPreviewPayloadFromNode(node) {
        if (!node) return null;
        return {
            id: parseInt(node.getAttribute('data-doc-id') || '0', 10) || 0,
            original_name: String(node.getAttribute('data-doc-name') || 'file'),
            type_group: String(node.getAttribute('data-type-group') || 'other'),
            mime_type: String(node.getAttribute('data-mime') || 'application/octet-stream'),
            view_url: String(node.getAttribute('data-view-url') || '#'),
            download_url: String(node.getAttribute('data-download-url') || '#')
        };
    }

    function markEventViewed(eventId) {
        var id = String(eventId || '').trim();
        if (!id) return Promise.resolve(null);
        return fetch('/api/notify/viewed', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ event_id: id, _csrf: csrfToken() })
        }).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        });
    }

    function ensureEventOverlayHandlers() {
        var overlay = document.getElementById('infoOverlay');
        if (!overlay) return null;
        if (overlay.dataset && overlay.dataset.cabinetFilesBound === '1') return overlay;
        try { if (overlay.dataset) overlay.dataset.cabinetFilesBound = '1'; } catch (_) { /* no-op */ }

        var closeBtn = document.getElementById('infoClose');
        var okBtn = document.getElementById('infoOk');
        if (closeBtn) {
            closeBtn.addEventListener('click', function (event) {
                event.preventDefault();
                closeEventOverlay();
            });
        }
        if (okBtn) {
            okBtn.addEventListener('click', function (event) {
                event.preventDefault();
                closeEventOverlay();
            });
        }
        overlay.addEventListener('click', function (event) {
            var target = event.target;
            if (!target) return;
            if (target === overlay) {
                closeEventOverlay();
                return;
            }
            var previewNode = target.closest ? target.closest('[data-cab-doc-action="preview"]') : null;
            if (previewNode) {
                event.preventDefault();
                var payload = eventInfoDocPreviewPayloadFromNode(previewNode);
                if (payload) openPreview(payload);
                return;
            }
            var markViewedNode = target.closest ? target.closest('[data-cab-action="mark-viewed"]') : null;
            if (markViewedNode) {
                event.preventDefault();
                var eventId = String(markViewedNode.getAttribute('data-event-id') || '');
                markViewedNode.disabled = true;
                markEventViewed(eventId)
                    .then(function () {
                        loadEventSeenBlock(eventId, String(overlay.getAttribute('data-cab-preview-key') || '0'));
                    })
                    .catch(function () {
                        toast('Не вдалося позначити подію як переглянуту.', 'error', 2200);
                    })
                    .finally(function () {
                        markViewedNode.disabled = false;
                    });
            }
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && overlay.classList.contains('show')) {
                closeEventOverlay();
            }
        });
        return overlay;
    }

    function eventInfoTypeLabel(typeValue) {
        var type = String(typeValue || '').trim().toLowerCase();
        if (type === 'mi') return 'ТЛГ: МИ';
        if (type === 'nas') return 'ТЛГ: НАС';
        if (type === 'evt') return 'Захід';
        return 'Інше';
    }

    function eventInfoFormatIso(value) {
        var raw = String(value || '').trim();
        if (!raw) return '—';
        var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return m[3] + '.' + m[2] + '.' + m[1];
        return raw;
    }

    function eventInfoWeekdayShort(value) {
        var raw = String(value || '').trim();
        var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return '';
        try {
            return new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))));
        } catch (_) {
            return '';
        }
    }

    function eventInfoOwnerDisplay(eventRow) {
        var owner = String((eventRow && eventRow.owner) || '').trim();
        return owner || '—';
    }

    function eventInfoDocIcon(doc) {
        return previewKind(doc) === 'image' ? '🖼' : '📎';
    }

    function eventInfoActionSvg(name) {
        switch (String(name || '')) {
            case 'preview':
                return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            case 'download':
                return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v10m0 0 4-4m-4 4-4-4M5 18.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            default:
                return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
        }
    }

    function eventInfoDocDatasetAttrs(doc) {
        doc = doc || {};
        return ''
            + ' data-doc-id="' + escapeHtml(String(doc.id || 0)) + '"'
            + ' data-doc-name="' + escapeHtml(String(doc.original_name || 'file')) + '"'
            + ' data-type-group="' + escapeHtml(String(doc.type_group || 'other')) + '"'
            + ' data-mime="' + escapeHtml(String(doc.mime_type || 'application/octet-stream')) + '"'
            + ' data-view-url="' + escapeHtml(String(doc.view_url || '#')) + '"'
            + ' data-download-url="' + escapeHtml(String(doc.download_url || '#')) + '"';
    }

    function eventInfoFormatCountSuffix(value) {
        var n = parseInt(value || 0, 10) || 0;
        if (n === 1) return 'відмітка';
        if (n >= 2 && n <= 4) return 'відмітки';
        return 'відміток';
    }

    function buildAcceptedFooterHtml(eventRow) {
        eventRow = eventRow || {};
        try {
            var acceptedAtRaw = eventRow.accepted_at != null ? String(eventRow.accepted_at).trim() : '';
            var acceptedMarks = Array.isArray(eventRow.accepted_marks) ? eventRow.accepted_marks : [];
            var acceptedCount = parseInt(eventRow.accepted_marks_count != null ? eventRow.accepted_marks_count : (acceptedMarks.length || (acceptedAtRaw ? 1 : 0)), 10) || 0;
            if (acceptedAtRaw === '' && acceptedCount <= 0) return '';

            function formatOne(mark) {
                mark = mark || {};
                var markAtRaw = mark.accepted_at != null ? String(mark.accepted_at).trim() : '';
                if (!markAtRaw) return '';
                var markAtText = formatDateTime(markAtRaw);
                var markByText = mark.accepted_by_name ? String(mark.accepted_by_name) : '';
                if (!markByText && mark.accepted_by_user_id) {
                    markByText = 'User #' + String(mark.accepted_by_user_id);
                }
                var parts = [];
                if (markByText) parts.push(escapeHtml(markByText));
                parts.push(escapeHtml(markAtText));
                return parts.join(' — ');
            }

            if (acceptedMarks.length <= 1) {
                var singleMark = acceptedMarks.length === 1 ? acceptedMarks[0] : {
                    accepted_at: acceptedAtRaw,
                    accepted_by_name: eventRow.accepted_by_name || '',
                    accepted_by_user_id: eventRow.accepted_by_user_id || 0
                };
                var singleText = formatOne(singleMark);
                if (!singleText) return '';
                return '<div class="info-accepted-footer"><strong>Прийнято на виконання:</strong> ' + singleText + '</div>';
            }

            var itemsHtml = acceptedMarks.map(function (mark, idx) {
                var line = formatOne(mark);
                if (!line) return '';
                return '<div class="info-accepted-footer__item">' + escapeHtml(String(idx + 1) + '.') + ' ' + line + '</div>';
            }).filter(Boolean).join('');
            var countText = String(acceptedCount) + ' ' + eventInfoFormatCountSuffix(acceptedCount);
            return ''
                + '<details class="info-accepted-footer info-accepted-footer--details">'
                +   '<summary><strong>Прийнято на виконання:</strong> ' + escapeHtml(countText) + '</summary>'
                +   '<div class="info-accepted-footer__list">' + itemsHtml + '</div>'
                + '</details>';
        } catch (_) {
            return '';
        }
    }

    function buildEventInfoHtml(eventRow) {
        eventRow = eventRow || {};
        var dateISO = String(eventRow.start_date || '').trim();
        var dateHtml = eventInfoFormatIso(dateISO);
        var weekday = eventInfoWeekdayShort(dateISO);
        var timeText = String(eventRow.time || '').trim();
        var dateTimeHtml = dateHtml + (weekday ? (' (' + escapeHtml(weekday) + ')') : '') + (timeText ? (' (' + escapeHtml(timeText) + ')') : '');
        var createdHtml = eventRow.created_at ? escapeHtml(formatDateTime(eventRow.created_at)) : '—';
        var descRaw = typeof eventRow.description === 'string' ? eventRow.description : '';
        var descHtml = descRaw && String(descRaw).trim() !== '' ? escapeHtml(descRaw) : '—';
        var endBlock = '';
        if (eventRow.end_date) {
            endBlock = '<div class="info-row info-row--full"><div class="info-item"><strong>Дата завершення:</strong> ' + escapeHtml(eventInfoFormatIso(eventRow.end_date)) + '</div></div>';
        }
        var docsRow = '';
        if ((eventRow.incoming_no && String(eventRow.incoming_no).trim() !== '') || (eventRow.outgoing_no && String(eventRow.outgoing_no).trim() !== '')) {
            docsRow = ''
                + '<div class="info-row info-row--docs">'
                +   '<div class="info-item"><strong>Вхідний №:</strong> ' + escapeHtml(String(eventRow.incoming_no || '—')) + '</div>'
                +   '<div class="info-item"><strong>Вихідний №:</strong> ' + escapeHtml(String(eventRow.outgoing_no || '—')) + '</div>'
                + '</div>';
        }
        return ''
            + '<div class="info-title">' + escapeHtml(String(eventRow.title || '')) + '</div>'
            + '<div class="info-grid">'
            +   '<div class="info-row">'
            +     '<div class="info-item"><strong>Дата:</strong> ' + dateTimeHtml + '</div>'
            +     '<div class="info-item"><strong>Відповідальний:</strong> ' + escapeHtml(eventInfoOwnerDisplay(eventRow)) + '</div>'
            +   '</div>'
            +   endBlock
            +   '<div class="info-row info-row--meta3">'
            +     '<div class="info-item"><strong>Створено:</strong> ' + createdHtml + '</div>'
            +     '<div class="info-item"><strong>Власник:</strong> ' + escapeHtml(String(eventRow.author_name || eventRow.user_name || eventRow.user_login || ('User #' + String(eventRow.user_id || '—')))) + '</div>'
            +   '</div>'
            +   '<div class="info-row info-row--full">'
            +     '<div class="info-meta3 info-meta3--full">'
            +       '<div class="info-item"><strong>Тип:</strong> ' + escapeHtml(eventInfoTypeLabel(eventRow.type)) + '</div>'
            +       '<div class="info-item"><strong>Терміновість:</strong> ' + (eventRow.urgent ? 'так' : 'ні') + '</div>'
            +       '<div class="info-item"><strong>Виконана:</strong> ' + (eventRow.done ? '<span class="info-done info-done--yes">так</span>' : '<span class="info-done">ні</span>') + '</div>'
            +     '</div>'
            +   '</div>'
            +   docsRow
            +   '<div class="info-row info-row--full">'
            +     '<div class="info-desc-body container auto">' + descHtml + '</div>'
            +   '</div>'
            + '</div>'
            + '<div class="info-seen-divider"></div>'
            + '<div id="cabInfoSeenBlock" class="info-seen-block"><div class="muted">Завантаження переглядів…</div></div>'
            + '<details class="info-thread-wrap" id="cabInfoThreadWrap">'
            +   '<summary class="info-thread-head">'
            +     '<span class="info-thread-head__title"><strong>Коментарі <span id="cabInfoThreadCount" class="info-thread-count"></span></strong><span class="info-thread-head__caret" aria-hidden="true">▸</span></span>'
            +   '</summary>'
            +   '<div class="info-thread-body">'
            +     '<div id="cabInfoThreadList" class="info-thread-list"><div class="info-thread-loading">Завантаження коментарів…</div></div>'
            +   '</div>'
            + '</details>'
            + '<details class="info-files-wrap" id="cabInfoFilesWrap">'
            +   '<summary class="info-files-head"><strong>Файли <span id="cabInfoFilesCount" class="info-files-count"></span></strong></summary>'
            +   '<div class="info-files-body">'
            +     '<div id="cabInfoFilesList" class="info-files-list"><div class="info-files-loading">Завантаження файлів…</div></div>'
            +   '</div>'
            + '</details>'
            + (isAdmin ? ('<details class="info-history-wrap" id="cabInfoHistoryWrap"><summary class="info-history-head"><strong>Історія змін</strong></summary><div id="cabInfoHistoryList" class="info-history-list"><div class="info-history-loading">Завантаження історії…</div></div></details>') : '');
    }

    function setEventInfoFooter(eventRow) {
        var footerMetaEl = document.getElementById('infoFooterMeta');
        if (!footerMetaEl) return;
        footerMetaEl.innerHTML = buildAcceptedFooterHtml(eventRow);
    }

    function setEventInfoActions(eventRow) {
        var editBtn = document.getElementById('editEvBtn');
        var pdfLink = document.getElementById('infoPdfLink');
        if (editBtn) {
            editBtn.hidden = true;
            editBtn.setAttribute('aria-hidden', 'true');
            editBtn.tabIndex = -1;
        }
        if (pdfLink) {
            var eventId = String((eventRow && eventRow.id) || '');
            pdfLink.hidden = !eventId;
            pdfLink.setAttribute('aria-hidden', eventId ? 'false' : 'true');
            pdfLink.tabIndex = eventId ? 0 : -1;
            pdfLink.href = eventId ? ('/print/event?id=' + encodeURIComponent(eventId)) : '#';
        }
    }

    function renderSeenBlock(targetEl, payload, eventId) {
        if (!targetEl) return;
        payload = payload || {};
        var seen = Array.isArray(payload.seen) ? payload.seen : [];
        var unseen = Array.isArray(payload.unseen) ? payload.unseen : [];
        var html = '';
        var overlay = document.getElementById('infoOverlay');
        var meId = parseInt((overlay && overlay.getAttribute('data-current-user-id')) || '0', 10) || 0;
        var meInSeen = false;
        if (meId > 0) {
            for (var si = 0; si < seen.length; si++) {
                if (parseInt(((seen[si] || {}).user_id) || 0, 10) === meId) { meInSeen = true; break; }
            }
        }
        var canMarkViewed = (!meInSeen && meId > 0 && String(eventId || '').trim() !== '');

        html += '<div class="info-seen-grid">';
        html += '<section class="info-seen-col info-seen-col--seen">';
        html += '<div class="info-seen-head"><strong>Переглянули:</strong>'
            + (canMarkViewed
                ? ('<button type="button" class="notif-iconbtn notif-iconbtn--sm info-markviewed" data-cab-action="mark-viewed" data-event-id="' + escapeHtml(String(eventId || '')) + '" title="Переглянуто" aria-label="Позначити як переглянуте"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></button>')
                : '')
            + '</div>';
        if (!seen.length) {
            html += '<div class="muted">Поки ніхто не переглянув</div>';
        } else {
            html += '<div class="info-seen-list">';
            for (var i = 0; i < seen.length; i++) {
                var it = seen[i] || {};
                var label = escapeHtml(String(it.label || ('#' + (it.user_id || ''))));
                var t = it.seen_at ? escapeHtml(String(it.seen_at)) : '';
                html += '<span class="info-seen-chip"><span>' + label + '</span>' + (t ? ('<time>' + t + '</time>') : '') + '</span>';
            }
            html += '</div>';
        }
        html += '</section>';
        html += '<section class="info-seen-col info-seen-col--unseen">';
        html += '<div class="info-seen-head"><strong>Не переглянули:</strong></div>';
        if (!unseen.length) {
            html += '<div class="muted">Усі переглянули</div>';
        } else {
            html += '<div class="info-seen-list">';
            for (var j = 0; j < unseen.length; j++) {
                var u = unseen[j] || {};
                var ul = escapeHtml(String(u.label || ('#' + (u.user_id || ''))));
                html += '<span class="info-seen-chip"><span>' + ul + '</span></span>';
            }
            html += '</div>';
        }
        html += '</section>';
        html += '</div>';
        targetEl.innerHTML = html;
    }

    function loadEventSeenBlock(eventId, requestKey) {
        var host = document.getElementById('cabInfoSeenBlock');
        var overlay = document.getElementById('infoOverlay');
        if (!host || !overlay) return;
        fetch('/api/notify/seen-by-event?event_id=' + encodeURIComponent(String(eventId || '')), {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
        })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (payload) {
                if (String(overlay.getAttribute('data-cab-preview-key') || '') !== String(requestKey || '')) return;
                if (!payload || payload.ok !== true) {
                    host.innerHTML = '<div class="muted">Не вдалося завантажити статус перегляду.</div>';
                    return;
                }
                renderSeenBlock(host, payload, eventId);
            })
            .catch(function () {
                if (String(overlay.getAttribute('data-cab-preview-key') || '') !== String(requestKey || '')) return;
                host.innerHTML = '<div class="muted">Не вдалося завантажити статус перегляду.</div>';
            });
    }

    function eventInfoGroupDocsByMessageId(docs) {
        var map = {};
        docs = Array.isArray(docs) ? docs : [];
        for (var i = 0; i < docs.length; i++) {
            var doc = docs[i] || {};
            var messageId = parseInt(doc.message_id || 0, 10) || 0;
            if (messageId <= 0) continue;
            if (!map[messageId]) map[messageId] = [];
            map[messageId].push(doc);
        }
        return map;
    }

    function eventInfoRenderAttachments(docs) {
        docs = Array.isArray(docs) ? docs : [];
        if (!docs.length) return '';
        var html = '<div class="info-thread-attachments">';
        for (var i = 0; i < docs.length; i++) {
            var d = docs[i] || {};
            var attrs = eventInfoDocDatasetAttrs(d);
            var previewable = canPreview(d);
            html += ''
                + '<div class="info-thread-attachment" data-doc-id="' + escapeHtml(String(d.id || 0)) + '">'
                +   '<span class="info-thread-attachment__icon" aria-hidden="true">' + escapeHtml(eventInfoDocIcon(d)) + '</span>'
                +   (previewable
                    ? '<button type="button" class="info-thread-attachment__name info-thread-attachment__name--button" data-cab-doc-action="preview"' + attrs + '>' + escapeHtml(String(d.original_name || 'file')) + '</button>'
                    : '<a class="info-thread-attachment__name" href="' + escapeHtml(String(d.view_url || '#')) + '" target="_blank" rel="noopener">' + escapeHtml(String(d.original_name || 'file')) + '</a>')
                +   '<span class="info-thread-attachment__size">' + escapeHtml(formatSize(d.file_size || 0)) + '</span>'
                +   '<span class="info-thread-attachment__actions">'
                +     (previewable
                    ? '<button type="button" class="info-thread-icon-action info-thread-icon-action--preview" data-cab-doc-action="preview"' + attrs + ' title="Переглянути файл" aria-label="Переглянути файл">' + eventInfoActionSvg('preview') + '</button>'
                    : '<a class="info-thread-icon-action info-thread-icon-action--preview" href="' + escapeHtml(String(d.view_url || '#')) + '" target="_blank" rel="noopener" title="Переглянути файл" aria-label="Переглянути файл">' + eventInfoActionSvg('preview') + '</a>')
                +     '<a class="info-thread-icon-action info-thread-icon-action--download" href="' + escapeHtml(String(d.download_url || '#')) + '" target="_blank" rel="noopener" title="Завантажити файл" aria-label="Завантажити файл">' + eventInfoActionSvg('download') + '</a>'
                +   '</span>'
                + '</div>';
        }
        html += '</div>';
        return html;
    }

    function eventInfoAvatarHtml(author) {
        author = author || {};
        var display = String(author.display || author.name || author.login || ('User #' + String(author.id || 0)));
        if (author.avatar_url) {
            return '<img src="' + escapeHtml(String(author.avatar_url)) + '" alt="' + escapeHtml(display) + '">';
        }
        return '<span>' + escapeHtml(eventInfoInitials(display)) + '</span>';
    }

    function eventInfoRenderMessages(messages, docs) {
        var host = document.getElementById('cabInfoThreadList');
        var countEl = document.getElementById('cabInfoThreadCount');
        if (!host) return;
        messages = Array.isArray(messages) ? messages : [];
        docs = Array.isArray(docs) ? docs : [];
        if (countEl) countEl.textContent = messages.length ? String(messages.length) : '';
        if (!messages.length) {
            host.innerHTML = '<div class="info-thread-empty"><div class="info-thread-empty__title">Поки немає коментарів</div><div class="info-thread-empty__text">Коментарі до цієї події з’являться тут.</div></div>';
            return;
        }
        var docsByMessage = eventInfoGroupDocsByMessageId(docs);
        var html = '';
        for (var i = 0; i < messages.length; i++) {
            var item = messages[i] || {};
            var author = item.author || {};
            var display = String(author.display || author.name || author.login || ('User #' + String(item.user_id || 0)));
            var avatarClass = 'info-thread-message__avatar' + (author.avatar_url ? ' has-image' : '');
            var itemDocs = docsByMessage[parseInt(item.id || 0, 10) || 0] || [];
            html += ''
                + '<article class="info-thread-message" data-message-id="' + escapeHtml(String(item.id || 0)) + '">'
                +   '<div class="' + avatarClass + '">' + eventInfoAvatarHtml(author) + '</div>'
                +   '<div class="info-thread-message__body">'
                +     '<div class="info-thread-message__meta">'
                +       '<span class="info-thread-message__author">' + escapeHtml(display) + '</span>'
                +       '<time class="info-thread-message__time" datetime="' + escapeHtml(String(item.created_at || '')) + '">' + escapeHtml(formatDateTime(item.created_at || '')) + '</time>'
                +       (item.edited_at ? '<span class="info-thread-message__edited">відредаговано</span>' : '')
                +     '</div>'
                +     '<div class="info-thread-message__text">' + escapeHtml(String(item.message_text || '')) + '</div>'
                +     eventInfoRenderAttachments(itemDocs)
                +   '</div>'
                + '</article>';
        }
        host.innerHTML = html;
    }

    function eventInfoRenderFiles(docs) {
        var host = document.getElementById('cabInfoFilesList');
        var countEl = document.getElementById('cabInfoFilesCount');
        if (!host) return;
        docs = Array.isArray(docs) ? docs : [];
        if (countEl) countEl.textContent = docs.length ? String(docs.length) : '';
        if (!docs.length) {
            host.innerHTML = '<div class="info-files-empty"><div class="info-files-empty__title">Поки немає файлів</div><div class="info-files-empty__text">Файли до цієї події з’являться тут після завантаження у коментарях.</div></div>';
            return;
        }
        var html = '';
        for (var i = 0; i < docs.length; i++) {
            var doc = docs[i] || {};
            var previewable = canPreview(doc);
            var attrs = eventInfoDocDatasetAttrs(doc);
            var uploader = String((((doc || {}).uploader || {}).display) || '—');
            var commentLabel = (parseInt(doc.message_id || 0, 10) || 0) > 0 ? ('Коментар #' + String(doc.message_id || 0)) : 'Без коментаря';
            html += ''
                + '<article class="info-files-item" data-doc-id="' + escapeHtml(String(doc.id || 0)) + '">'
                +   '<div class="info-files-item__icon" aria-hidden="true">' + escapeHtml(eventInfoDocIcon(doc)) + '</div>'
                +   '<div class="info-files-item__body">'
                +     '<div class="info-files-item__top">'
                +       (previewable
                    ? '<button type="button" class="info-files-item__name info-files-item__name--button" data-cab-doc-action="preview"' + attrs + '>' + escapeHtml(String(doc.original_name || 'file')) + '</button>'
                    : '<a class="info-files-item__name" href="' + escapeHtml(String(doc.view_url || '#')) + '" target="_blank" rel="noopener">' + escapeHtml(String(doc.original_name || 'file')) + '</a>')
                +       '<span class="info-files-item__size">' + escapeHtml(formatSize(doc.file_size || 0)) + '</span>'
                +     '</div>'
                +     '<div class="info-files-item__meta">'
                +       '<span>Завантажив: ' + escapeHtml(uploader) + '</span>'
                +       '<time datetime="' + escapeHtml(String(doc.created_at || '')) + '">' + escapeHtml(formatDateTime(doc.created_at || '')) + '</time>'
                +       '<span>' + escapeHtml(commentLabel) + '</span>'
                +     '</div>'
                +   '</div>'
                +   '<div class="info-files-item__actions">'
                +     (previewable
                    ? '<button type="button" class="info-thread-icon-action info-thread-icon-action--preview" data-cab-doc-action="preview"' + attrs + ' title="Переглянути файл" aria-label="Переглянути файл">' + eventInfoActionSvg('preview') + '</button>'
                    : '<a class="info-thread-icon-action info-thread-icon-action--preview" href="' + escapeHtml(String(doc.view_url || '#')) + '" target="_blank" rel="noopener" title="Переглянути файл" aria-label="Переглянути файл">' + eventInfoActionSvg('preview') + '</a>')
                +     '<a class="info-thread-icon-action info-thread-icon-action--download" href="' + escapeHtml(String(doc.download_url || '#')) + '" target="_blank" rel="noopener" title="Завантажити файл" aria-label="Завантажити файл">' + eventInfoActionSvg('download') + '</a>'
                +   '</div>'
                + '</article>';
        }
        host.innerHTML = html;
    }

    function eventInfoHistoryLine(item) {
        item = item || {};
        var actor = String(item.user_name || item.target_login || item.target_name || 'Система');
        var action = String(item.action || '').replace(/[_\.]+/g, ' ').trim();
        if (!action) action = 'оновлення';
        return actor + ' — ' + action;
    }

    function eventInfoRenderHistory(items) {
        var host = document.getElementById('cabInfoHistoryList');
        if (!host) return;
        items = Array.isArray(items) ? items.slice() : [];
        items = items.filter(function (it) {
            return it && String(it.entity_type || '') === 'event';
        });
        if (!items.length) {
            host.innerHTML = '<div class="info-history-empty">Історія змін поки відсутня.</div>';
            return;
        }
        items.reverse();
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var it = items[i] || {};
            html += '<div class="info-history-item"><div class="info-history-line"><span class="info-history-ts">' + escapeHtml(formatDateTime(it.ts || '')) + '</span><span class="info-history-text">' + escapeHtml(eventInfoHistoryLine(it)) + '</span></div></div>';
        }
        host.innerHTML = html;
    }

    function loadEventCollections(eventId, requestKey) {
        var overlay = document.getElementById('infoOverlay');
        if (!overlay) return;
        var threadHost = document.getElementById('cabInfoThreadList');
        var filesHost = document.getElementById('cabInfoFilesList');
        if (threadHost) threadHost.innerHTML = '<div class="info-thread-loading">Завантаження коментарів…</div>';
        if (filesHost) filesHost.innerHTML = '<div class="info-files-loading">Завантаження файлів…</div>';
        Promise.all([
            fetch('/api/event-messages/list?event_id=' + encodeURIComponent(String(eventId || '')), { method: 'GET', credentials: 'same-origin', headers: { 'Accept': 'application/json' } }).then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            }),
            fetch('/api/documents/list-by-event?event_id=' + encodeURIComponent(String(eventId || '')), { method: 'GET', credentials: 'same-origin', headers: { 'Accept': 'application/json' } }).then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
        ])
            .then(function (results) {
                if (String(overlay.getAttribute('data-cab-preview-key') || '') !== String(requestKey || '')) return;
                var messagesPayload = results[0] || {};
                var docsPayload = results[1] || {};
                var messages = messagesPayload && messagesPayload.ok ? (messagesPayload.items || []) : [];
                var docs = docsPayload && docsPayload.ok ? (docsPayload.items || []) : [];
                eventInfoRenderMessages(messages, docs);
                eventInfoRenderFiles(docs);
            })
            .catch(function () {
                if (String(overlay.getAttribute('data-cab-preview-key') || '') !== String(requestKey || '')) return;
                if (threadHost) threadHost.innerHTML = '<div class="info-thread-empty"><div class="info-thread-empty__title">Не вдалося завантажити коментарі</div><div class="info-thread-empty__text">Спробуй оновити перегляд події ще раз.</div></div>';
                if (filesHost) filesHost.innerHTML = '<div class="info-files-empty"><div class="info-files-empty__title">Не вдалося завантажити файли</div><div class="info-files-empty__text">Спробуй відкрити подію ще раз.</div></div>';
            });
    }

    function loadEventHistoryBlock(eventId, requestKey) {
        if (!isAdmin) return;
        var overlay = document.getElementById('infoOverlay');
        var host = document.getElementById('cabInfoHistoryList');
        if (!overlay || !host) return;
        host.innerHTML = '<div class="info-history-loading">Завантаження історії…</div>';
        var qs = new URLSearchParams();
        qs.set('scope', 'all');
        qs.set('limit', '100');
        qs.set('entity_type', 'event');
        qs.set('entity_id', String(eventId || ''));
        fetch('/api/audit/list?' + qs.toString(), {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
        })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (payload) {
                if (String(overlay.getAttribute('data-cab-preview-key') || '') !== String(requestKey || '')) return;
                if (!payload || payload.ok !== true) {
                    host.innerHTML = '<div class="info-history-error">Історія: недоступно</div>';
                    return;
                }
                eventInfoRenderHistory(payload.items || []);
            })
            .catch(function () {
                if (String(overlay.getAttribute('data-cab-preview-key') || '') !== String(requestKey || '')) return;
                host.innerHTML = '<div class="info-history-error">Історія: помилка завантаження</div>';
            });
    }

    function renderEventOverlay(eventRow) {
        var overlay = ensureEventOverlayHandlers();
        if (!overlay || !eventRow) return;
        var modal = overlay.querySelector('.modal');
        var titleEl = document.getElementById('infoTitle');
        var contentEl = document.getElementById('infoContent');
        var headerBadges = document.getElementById('infoHeaderBadges');
        var typeClass = eventTypeClass(eventRow.type);
        var requestKey = String((parseInt(overlay.getAttribute('data-cab-preview-key') || '0', 10) || 0) + 1);
        overlay.setAttribute('data-cab-preview-key', requestKey);
        overlay.setAttribute('data-cab-event-id', String(eventRow.id || ''));

        if (modal && modal.classList) {
            modal.classList.remove('type-mi', 'type-nas', 'type-evt', 'type-other');
            modal.classList.add(typeClass);
        }
        if (titleEl) {
            titleEl.textContent = 'Деталі події';
        }
        if (headerBadges) {
            headerBadges.hidden = true;
            headerBadges.innerHTML = '';
        }
        setEventInfoActions(eventRow);
        setEventInfoFooter(eventRow);
        if (contentEl) {
            contentEl.innerHTML = buildEventInfoHtml(eventRow);
        }
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.removeAttribute('inert');
        loadEventSeenBlock(eventRow.id, requestKey);
        loadEventCollections(eventRow.id, requestKey);
        loadEventHistoryBlock(eventRow.id, requestKey);
    }

    function openEventPreview(eventId) {
        var id = String(eventId || '').trim();
        if (!id) return;
        setStatus('Завантаження події…', 'loading');
        fetch('/api/events/get?id=' + encodeURIComponent(id), { method: 'GET', credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (payload) {
                if (!payload || !payload.ok || !payload.event) {
                    throw new Error('event_not_found');
                }
                renderEventOverlay(payload.event);
                setStatus('Подію відкрито.', 'success');
            })
            .catch(function () {
                toast('Не вдалося відкрити перегляд події.', 'error', 2200);
                setStatus('Помилка відкриття події.', 'error');
            });
    }

    function previewKind(item) {
        if (!item) return '';
        var group = String(item.type_group || '');
        var mime = String(item.mime_type || '').toLowerCase();
        if (group === 'image') return 'image';
        if (group === 'pdf') return 'pdf';
        if (mime.indexOf('text/') === 0) return 'text';
        return '';
    }

    function canPreview(item) {
        return previewKind(item) !== '';
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
            btn.setAttribute('aria-pressed', String(String(btn.getAttribute('data-scope')) === state.scope));
        });
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
            var typeIcon = typeIconMarkup(typeGroup);
            var eventCell = '—';
            if (item.event_id) {
                eventCell = '<button type="button" class="cab-files__eventLink" data-action="open-event" data-event-id="' + escapeHtml(String(item.event_id)) + '">' + escapeHtml(eventTitle) + '</button>' + eventMeta;
            }
            var actions = '';
            actions += '<button type="button" class="cab-action-link cab-action-link--button" data-action="preview" data-id="' + String(item.id || 0) + '" data-view-url="' + escapeHtml(String(item.view_url || '#')) + '" data-download-url="' + escapeHtml(String(item.download_url || '#')) + '" data-type-group="' + escapeHtml(typeGroup) + '" data-mime="' + escapeHtml(String(item.mime_type || 'application/octet-stream')) + '" data-name="' + escapeHtml(title) + '">Перегляд</button>';
            actions += '<span class="cab-action-sep">•</span>';
            actions += '<a class="cab-action-link" href="' + escapeHtml(String(item.download_url || '#')) + '">Скачати</a>';
            actions += '<span class="cab-action-sep">•</span>';
            actions += '<button type="button" class="cab-action-link cab-action-link--button cab-action-link--danger" data-action="delete" data-id="' + String(item.id || 0) + '" data-name="' + escapeHtml(title) + '">Видалити</button>';

            return '' +
                '<tr data-id="' + String(item.id || 0) + '">' +
                    '<td class="cab-files__nameCell">' +
                        '<div class="cab-files__name">' + escapeHtml(title) + '</div>' +
                        '<div class="cab-files__mime">' + escapeHtml(String(item.mime_type || 'application/octet-stream')) + '</div>' +
                    '</td>' +
                    '<td class="cab-files__typeCell">' + typeIcon + '</td>' +
                    '<td>' + escapeHtml(formatSize(item.file_size || 0)) + '</td>' +
                    '<td>' + escapeHtml(uploader) + '</td>' +
                    '<td><div class="cab-files__eventTitle">' + eventCell + '</div></td>' +
                    '<td>' + escapeHtml(formatDateTime(item.created_at || '')) + '</td>' +
                    '<td><div class="cab-files__rowActions">' + actions + '</div></td>' +
                '</tr>';
        }).join('');
        tbody.innerHTML = html;
    }

    function renderPreview() {
        if (!preview) return;
        var previewState = state.preview || {};
        var item = previewState.item || null;
        var kind = String(previewState.kind || '');
        var title = item ? String(item.original_name || 'Перегляд файла') : 'Перегляд файла';
        var mime = item ? String(item.mime_type || '') : '';
        if (previewTitle) previewTitle.textContent = title;
        if (previewMeta) previewMeta.textContent = item ? (typeLabel(item.type_group || '') + (mime ? ' · ' + mime : '')) : '';
        if (previewDownload) {
            previewDownload.href = item ? String(item.download_url || '#') : '#';
            previewDownload.setAttribute('aria-disabled', item && item.download_url ? 'false' : 'true');
        }
        if (previewFullscreen) {
            previewFullscreen.hidden = !previewState.open;
            previewFullscreen.setAttribute('aria-pressed', previewState.fullscreen ? 'true' : 'false');
            previewFullscreen.title = previewState.fullscreen ? 'Вийти з повноекранного режиму' : 'На весь екран';
            previewFullscreen.setAttribute('aria-label', previewState.fullscreen ? 'Вийти з повноекранного режиму' : 'На весь екран');
        }
        if (previewBody) {
            if (!previewState.open || !item) {
                previewBody.innerHTML = '';
            } else if (kind === 'image') {
                previewBody.innerHTML = '<img class="info-thread-preview__image" src="' + escapeHtml(String(item.view_url || '#')) + '" alt="' + escapeHtml(title) + '">';
            } else if (kind === 'pdf') {
                previewBody.innerHTML = '<iframe class="info-thread-preview__frame" src="' + escapeHtml(String(item.view_url || '#')) + '" title="' + escapeHtml(title) + '"></iframe>';
            } else if (kind === 'text') {
                previewBody.innerHTML = previewState.textLoading
                    ? '<div class="info-thread-preview__fallback">Завантаження текстового перегляду…</div>'
                    : '<pre class="info-thread-preview__text">' + escapeHtml(previewState.textContent || '') + '</pre>';
            } else {
                previewBody.innerHTML = '<div class="info-thread-preview__fallback">Для цього типу файла вбудований перегляд недоступний.</div>';
            }
        }
        preview.hidden = !previewState.open;
        preview.classList.toggle('is-open', !!previewState.open);
        preview.classList.toggle('is-fullscreen', !!previewState.fullscreen);
        preview.setAttribute('aria-hidden', previewState.open ? 'false' : 'true');
        document.body.classList.toggle('is-cab-files-preview-open', !!previewState.open);
    }

    function setPreviewFullscreen(enabled) {
        state.preview.fullscreen = !!enabled;
        renderPreview();
    }

    function togglePreviewFullscreen() {
        if (!preview || !state.preview || !state.preview.open) return;
        var dialog = preview.querySelector('.info-thread-preview__dialog');
        var fullscreenTarget = document.fullscreenElement || null;
        if (!dialog) return;
        if (fullscreenTarget === dialog) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(function () {
                    setPreviewFullscreen(false);
                });
            } else {
                setPreviewFullscreen(false);
            }
            return;
        }
        if (dialog.requestFullscreen) {
            dialog.requestFullscreen().then(function () {
                setPreviewFullscreen(true);
            }).catch(function () {
                setPreviewFullscreen(!state.preview.fullscreen);
            });
            return;
        }
        setPreviewFullscreen(!state.preview.fullscreen);
    }

    function openPreview(item) {
        if (!item) return;
        var kind = previewKind(item);
        if (!kind) {
            if (item.view_url) window.open(String(item.view_url), '_blank', 'noopener');
            return;
        }
        state.preview.open = true;
        state.preview.item = item;
        state.preview.kind = kind;
        state.preview.textLoading = kind === 'text';
        state.preview.textContent = '';
        state.preview.fullscreen = false;
        state.preview.requestKey = (parseInt(state.preview.requestKey || 0, 10) || 0) + 1;
        var requestKey = state.preview.requestKey;
        renderPreview();
        if (kind === 'text') {
            fetch(String(item.view_url || '#'), { credentials: 'same-origin' })
                .then(function (response) {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.text();
                })
                .then(function (textValue) {
                    if ((parseInt(state.preview.requestKey || 0, 10) || 0) !== requestKey) return;
                    state.preview.textContent = String(textValue || '');
                    state.preview.textLoading = false;
                    renderPreview();
                })
                .catch(function () {
                    if ((parseInt(state.preview.requestKey || 0, 10) || 0) !== requestKey) return;
                    state.preview.textContent = 'Не вдалося завантажити текстовий перегляд.';
                    state.preview.textLoading = false;
                    renderPreview();
                });
        }
        setTimeout(function () {
            if (previewCloseBtn) {
                try { previewCloseBtn.focus(); } catch (e) { /* no-op */ }
            }
        }, 0);
    }

    function closePreview() {
        if (!preview) return;
        var dialog = preview.querySelector('.info-thread-preview__dialog');
        if ((document.fullscreenElement || null) === dialog && document.exitFullscreen) {
            try { document.exitFullscreen(); } catch (e) { /* no-op */ }
        }
        state.preview.open = false;
        state.preview.fullscreen = false;
        state.preview.item = null;
        state.preview.kind = '';
        state.preview.textLoading = false;
        state.preview.textContent = '';
        state.preview.requestKey = (parseInt(state.preview.requestKey || 0, 10) || 0) + 1;
        renderPreview();
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
            if (action === 'open-event') {
                openEventPreview(target.getAttribute('data-event-id') || '');
                return;
            }
            if (action === 'preview') {
                var row = {
                    id: id,
                    original_name: target.getAttribute('data-name') || ((tr && tr.querySelector('.cab-files__name')) ? tr.querySelector('.cab-files__name').textContent : ''),
                    type_group: target.getAttribute('data-type-group') || 'other',
                    mime_type: target.getAttribute('data-mime') || ((tr && tr.querySelector('.cab-files__mime')) ? tr.querySelector('.cab-files__mime').textContent : ''),
                    view_url: target.getAttribute('data-view-url') || '/api/documents/view?id=' + id,
                    download_url: target.getAttribute('data-download-url') || '/api/documents/download?id=' + id
                };
                openPreview(row);
            }
        });
    }
    if (preview) {
        preview.addEventListener('click', function (event) {
            var target = event.target;
            if (!target) return;
            var actionEl = target.closest ? target.closest('[data-preview-action]') : null;
            var action = actionEl ? String(actionEl.getAttribute('data-preview-action') || '') : '';
            if (action === 'close-preview') {
                event.preventDefault();
                closePreview();
                return;
            }
            if (action === 'toggle-preview-fullscreen') {
                event.preventDefault();
                togglePreviewFullscreen();
            }
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !preview.hidden) {
                closePreview();
            }
        });
        document.addEventListener('fullscreenchange', function () {
            var dialog = preview.querySelector('.info-thread-preview__dialog');
            setPreviewFullscreen((document.fullscreenElement || null) === dialog);
        });
    }

    setScope(state.scope);
    updatePager();
    loadList(true);
})();
