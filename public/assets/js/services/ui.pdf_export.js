(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function setTodayHref() {
    var link = $('btnTodayPdf');
    if (link) link.href = '/print/today?autoprint=1';
  }

  function setMonthHref() {
    var link = $('btnMonthPdf');
    if (!link) return;
    var ui = global.CalendarApp && global.CalendarApp.ui;
    if (!ui || typeof ui.getCurrentMonthContext !== 'function') {
      link.href = '/print/calendar-month?autoprint=1';
      return;
    }
    var ctx = ui.getCurrentMonthContext();
    var year = parseInt(ctx.year || 0, 10) || new Date().getFullYear();
    var month = parseInt(ctx.month || 0, 10) || (new Date().getMonth() + 1);
    link.href = '/print/calendar-month?year=' + year + '&month=' + month + '&autoprint=1';
  }


  function setPlanningHref() {
    var link = $('btnPlanningPdf');
    if (!link) return;
    var scope = 'exec';
    var isAdmin = false;
    try {
      var mount = document.getElementById('planning-today');
      isAdmin = !!(mount && mount.dataset && String(mount.dataset.userIsAdmin || '0') === '1');
      var checked = document.querySelector('#planning-toolbar input[name="planning-scope"]:checked');
      if (checked && checked.value) scope = String(checked.value);
      else {
        var saved = localStorage.getItem('planning.scope');
        if (saved) scope = String(saved);
      }
    } catch (_) { }
    if (!/^(all|my|exec)$/.test(scope)) scope = 'exec';
    if (!isAdmin && scope === 'all') scope = 'exec';
    link.href = '/print/planning?scope=' + encodeURIComponent(scope) + '&autoprint=1';
  }

  function bindPlanningRefreshers() {
    var inputs = document.querySelectorAll('#planning-toolbar input[name="planning-scope"]');
    if (!inputs || !inputs.length) return;
    inputs.forEach(function (el) {
      el.addEventListener('change', function () { setTimeout(setPlanningHref, 0); });
    });
  }

  function bindMonthRefreshers() {
    ['btnPrev', 'btnNext', 'btnToday'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('click', function () { setTimeout(setMonthHref, 0); });
    });
    var monthLabel = $('monthLabel');
    if (monthLabel && 'MutationObserver' in global) {
      try {
        new MutationObserver(function () { setMonthHref(); }).observe(monthLabel, { childList: true, subtree: true, characterData: true });
      } catch (_) { }
    }
  }

  function bindEventPdfLink() {
    var overlay = document.getElementById('infoOverlay');
    var link = document.getElementById('infoPdfLink');
    if (!overlay || !link) return;
    try {
      var mo = new MutationObserver(function () {
        var eventId = String(overlay.dataset.pdfEventId || '').trim();
        link.href = eventId ? ('/print/event?id=' + encodeURIComponent(eventId) + '&autoprint=1') : '#';
        link.setAttribute('aria-disabled', eventId ? 'false' : 'true');
      });
      mo.observe(overlay, { attributes: true, attributeFilter: ['data-pdf-event-id'] });
    } catch (_) { }
  }

  function init() {
    setTodayHref();
    setMonthHref();
    setPlanningHref();
    bindMonthRefreshers();
    bindPlanningRefreshers();
    bindEventPdfLink();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
