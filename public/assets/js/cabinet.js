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
