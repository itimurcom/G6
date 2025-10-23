// Tabs controller — ADD ONLY
(function () {
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
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { setTab(t.dataset.tab); }); });
    setTab('profile');
})();