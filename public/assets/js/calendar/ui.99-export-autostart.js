// Експорт UI API (якщо буде потрібно з інших скриптів)
  global.CalendarApp.ui.init = init;
  global.CalendarApp.ui.openModalNew  = openModalNew;
  global.CalendarApp.ui.openModalEdit = openModalEdit;

  // Автостарт
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
