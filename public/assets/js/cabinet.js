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
            if (h === 'settings' || h === 'security' || h === 'users' || h === 'journal' || h.indexOf('tab=') === 0) {
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
