/* calendar.ui.js — інтерфейс: DOM, рендер, модалки, таймлайн, чат, індикатор */
(function (global) {
  "use strict";

  var Data   = (global.CalendarApp && global.CalendarApp.data)   || {};
  var Ev     = (global.CalendarApp && global.CalendarApp.events) || {};

  /* ===== Стан інтерфейсу ===== */
  var locale='uk-UA';
  var today=new Date();
  var state={year:today.getFullYear(),month:today.getMonth()};
  var currentType='all';

  // DOM посилання
  function $(id){ return document.getElementById(id); }
  var monthLabel     = $('monthLabel');
  var todayLabel     = $('todayLabel');
  var todayPanelDate = $('todayPanelDate');
  var weekdaysEl     = $('weekdays');
  var grid           = $('grid');

  var filterText      = $('filterText');
  var btnClearFilters = $('btnClearFilters');
  var btnTypeMi       = $('btnTypeMi');
  var btnTypeNas      = $('btnTypeNas');
  var btnTypeEvt      = $('btnTypeEvt');
  var btnTypeOther    = $('btnTypeOther');
  var btnTypeReset    = $('btnTypeReset');

  var btnPrev = $('btnPrev');
  var btnNext = $('btnNext');
  var btnToday= $('btnToday');
  var quickFilters = $('quickFilters');

  var btnExport = $('btnExport');
  var btnImport = $('btnImport');
  var filePicker= $('filePicker');

  // Модалка редагування
  var overlay      = $('eventOverlay');
  var modal        = $('eventModal');
  var modalTitle   = $('modalTitle');
  var inputDate    = $('inputDate');
  var inputTime    = $('inputTime');
  var inputTitle   = $('inputTitle');
  var inputOwner   = $('inputOwner');
  var inputType    = $('inputType');
  var inputUrgent  = $('inputUrgent');
  var urgentSwitch = $('urgentSwitch');
  var inputDone    = $('inputDone');
  var doneSwitch   = $('doneSwitch');
  var btnClose     = $('btnClose');
  var btnCancel    = $('btnCancel');
  var editModal    = overlay ? overlay.querySelector('.modal') : null;

  // Інфо-модалка
  var infoOverlay = $('infoOverlay');
  var infoContent = $('infoContent');
  var infoClose   = $('infoClose');
  var infoOk      = $('infoOk');
  var infoModal   = infoOverlay ? infoOverlay.querySelector('.modal') : null;

  // Таймлайн «Сьогодні»
  var earlyWrap     = $('earlyWrap');
  var lateWrap      = $('lateWrap');
  var btnEarly      = $('btnEarly');
  var btnLate       = $('btnLate');
  var earlyTimeline = $('earlyTimeline');
  var todayTimeline = $('todayTimeline');
  var lateTimeline  = $('lateTimeline');

  // Чат
  var btnChat     = $('btnChat');
  var chatOverlay = $('chatOverlay');
  var chatClose   = $('chatClose');
  var chatOk      = $('chatOk');
  var chatContent = $('chatContent');

  // Форматери
  var monthFmt        = new Intl.DateTimeFormat(locale,{month:'long'});
  var weekdayShortFmt = new Intl.DateTimeFormat(locale,{weekday:'short'});
  var longHeaderFmt   = new Intl.DateTimeFormat(locale,{weekday:'short',day:'numeric',month:'long',year:'numeric'});

  if (todayLabel)     todayLabel.textContent     = longHeaderFmt.format(today).replace('.','');
  if (todayPanelDate) todayPanelDate.textContent = longHeaderFmt.format(today).replace('.','');

  