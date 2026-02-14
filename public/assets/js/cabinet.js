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

    var initialTab = defaultTab;
    try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved && allowed.indexOf(saved) !== -1) {
            initialTab = saved;
        }
    } catch (e) { /* no-op */ }

    setTab(initialTab);
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
