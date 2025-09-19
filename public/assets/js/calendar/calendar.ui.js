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

  // New optional fields
  var inputIncoming     = $('inputIncoming');    // Вхідний номер
  var inputOutgoing     = $('inputOutgoing');    // Вихідний номер
  var inputDescription  = $('inputDescription'); // Опис (textarea)

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
/* ===== Тост (індикатор) — внизу екрана ===== */
  function ensureSaveToast(){
    var t = $('saveToast');
    if (!t){
      t = document.createElement('div');
      t.id='saveToast';
      t.setAttribute('role','status');
      t.setAttribute('aria-live','polite');
      t.style.cssText = [
        'position:fixed',
        'bottom:16px',        
        'left:50%',
        'transform:translateX(-50%) translateY(8px)',
        'z-index:99999',
        'display:inline-flex',
        'align-items:center',
        'gap:8px',
        'padding:8px 12px',
        'border:1px solid var(--border)',
        'background:var(--event-bg)',
        'color:var(--fg)',
        'border-radius:999px',
        'font-size:13px',
        'font-weight:800',
        'box-shadow:0 8px 20px rgba(0,0,0,.12)',
        'opacity:0',
        'pointer-events:none',
        'transition:opacity .25s ease, transform .25s ease, background-color .2s ease, color .2s ease, border-color .2s ease'
      ].join(';');
      var ico=document.createElement('span'); ico.id='saveToastIcon'; ico.textContent='⏳';
      var txt=document.createElement('span'); txt.id='saveToastText'; txt.textContent='Збереження…';
      t.appendChild(ico); t.appendChild(txt);
      document.body.appendChild(t);
    }
    return t;
  }
  function setToastAnchor(){
    var t = ensureSaveToast();
    var hasBottom = !!document.querySelector('.bottom-actions');
    t.style.bottom = '16px';
  }

  function setToastMode(mode){
    var t=ensureSaveToast(); var ico=$('saveToastIcon');
    t.style.borderColor = 'var(--border)';
    t.style.boxShadow   = '0 8px 20px rgba(0,0,0,.12)';
    t.style.color       = 'var(--fg)';
    t.style.background  = 'var(--event-bg)';
    if (mode==='saving'){ ico.textContent='⏳'; }
    else if (mode==='ok'){
      if (typeof global.refresh == 'function') {
      global.refresh();
      }
      t.style.background='var(--type-evt)'; t.style.borderColor='var(--type-evt)'; t.style.color='#fff'; t.style.boxShadow='0 8px 24px rgba(34,197,94,.28)'; ico.textContent='✅';
    } else if (mode==='err'){
      t.style.background='var(--urgent)'; t.style.borderColor='var(--urgent)'; t.style.color='#fff'; t.style.boxShadow='0 8px 24px rgba(239,68,68,.28)'; ico.textContent='⚠️';
    }
  }
  function toastShow(){ var t=ensureSaveToast(); t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; }
  function toastHide(){ var t=ensureSaveToast(); t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(8px)'; }
  function showSaving(msg){ ensureSaveToast(); setToastAnchor(); setToastMode('saving'); $('saveToastText').textContent = msg || 'Збереження…'; toastShow(); }
  function hideSaving(ok){
    ensureSaveToast();
    if (ok===true){ setToastMode('ok'); $('saveToastText').textContent='Збережено'; setTimeout(toastHide,950); }
    else if (ok===false){ setToastMode('err'); $('saveToastText').textContent='Помилка збереження'; setTimeout(toastHide,1600); }
    else { toastHide(); }
  }

  // Експортуємо індикатор для data-модуля
  global.CalendarApp = global.CalendarApp || {};
  global.CalendarApp.ui = global.CalendarApp.ui || {};
  global.CalendarApp.ui.showSaving = showSaving;
  global.CalendarApp.ui.hideSaving = hideSaving;

  /* ===== Фільтри типів/пошуку ===== */
  function updateTypeButtons(){
    if (!btnTypeMi) return;
    btnTypeMi.classList.toggle('active',currentType==='mi');
    btnTypeNas.classList.toggle('active',currentType==='nas');
    btnTypeEvt.classList.toggle('active',currentType==='evt');
    btnTypeOther.classList.toggle('active',currentType==='other');
    if (btnTypeReset) btnTypeReset.style.display=(currentType==='all')?'none':'inline-grid';
  }
  function setTypeFilter(t){ currentType=t||'all'; updateTypeButtons(); renderAllCells(); renderTodayPanel(); }

  if (btnTypeMi)    btnTypeMi.addEventListener('click',function(){ setTypeFilter('mi'); });
  if (btnTypeNas)   btnTypeNas.addEventListener('click',function(){ setTypeFilter('nas'); });
  if (btnTypeEvt)   btnTypeEvt.addEventListener('click',function(){ setTypeFilter('evt'); });
  if (btnTypeOther) btnTypeOther.addEventListener('click',function(){ setTypeFilter('other'); });
  if (btnTypeReset) btnTypeReset.addEventListener('click',function(){ setTypeFilter('all'); });
  if (filterText)   filterText.addEventListener('input',function(){ renderAllCells(); renderTodayPanel(); });
  if (btnClearFilters) btnClearFilters.addEventListener('click',function(){ if(filterText) filterText.value=''; setTypeFilter('all'); });
  if (quickFilters) quickFilters.addEventListener('click',function(e){
    var b=e.target && e.target.closest ? e.target.closest('button[data-type]') : null;
    if(!b) return;
    setTypeFilter(b.getAttribute('data-type'));
    if (filterText) filterText.value = b.getAttribute('data-text') || '';
    renderAllCells(); renderTodayPanel();
  });

  /* ===== Навігація місяців ===== */
  function changeMonth(delta){
    var m=state.month+delta, y=state.year;
    if(m<0){m+=12;y--;} if(m>11){m-=12;y++;}
    state.month=m; state.year=y; renderCalendar();
  }
  if (btnPrev)  btnPrev.addEventListener('click',function(){ changeMonth(-1); });
  if (btnNext)  btnNext.addEventListener('click',function(){ changeMonth(1); });
  if (btnToday) btnToday.addEventListener('click',function(){ state.year=today.getFullYear(); state.month=today.getMonth(); renderCalendar(); });
  window.addEventListener('keydown',function(e){
    if (['INPUT','SELECT','TEXTAREA'].includes(e.target && e.target.tagName)) return;
    if (e.key==='ArrowLeft') changeMonth(-1);
    if (e.key==='ArrowRight') changeMonth(1);
  });

  /* ===== Імпорт/Експорт ===== */
if (btnExport) btnExport.addEventListener('click', function(){
  Data.serverLoadStore().then(function(data){
    var blob = new Blob([JSON.stringify(data || {}, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'events.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  });
});

if (btnImport) btnImport.addEventListener('click', function(){
  if (filePicker) filePicker.click();
});

if (filePicker) filePicker.addEventListener('change', function(e){
  var f = e.target.files && e.target.files[0]; if (!f) return;
  f.text().then(function(text){
    try{
      var parsed = JSON.parse(text);
      Data._setCache( Data.ensureStoreShape(parsed) );
      return Data.serverSaveStore(Data._getCache()).then(function(){
        renderAllCells(); renderTodayPanel();
      });
    }catch(err){
      alert('Не вдалося імпортувати файл. Перевірте формат JSON.');
    }
  }).finally(function(){ filePicker.value=''; });
});
/* ===== Модалки ===== */
  function setEditModalType(t){
    if (!editModal) return;
    editModal.classList.remove('type-mi','type-nas','type-evt','type-other');
    editModal.classList.add(t==='mi'?'type-mi':t==='nas'?'type-nas':t==='evt'?'type-evt':'type-other');
  }
  function applyUrgentClass(){
    if (!editModal || !urgentSwitch || !inputUrgent) return;
    editModal.classList.remove('urgent');
    urgentSwitch.classList.toggle('active', !!inputUrgent.checked);
  }
  function applyDoneClass(){
    if (!editModal || !doneSwitch || !inputDone) return;
    doneSwitch.classList.toggle('active', !!inputDone.checked);
  }
  if (inputType)   inputType.addEventListener('change',function(){ setEditModalType(inputType.value); });
  if (inputUrgent) inputUrgent.addEventListener('change',applyUrgentClass);
  if (inputDone)   inputDone.addEventListener('change',applyDoneClass);

  function showOverlay(){
    if (!overlay) return;
    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden','false');
    overlay.classList.add('show');
    document.body.style.overflow='hidden';
    setTimeout(function(){ if(inputTitle) inputTitle.focus(); },0);
  }
  function closeOverlay(){
    if (!overlay) return;
    if (overlay.contains(document.activeElement)) { try{ document.activeElement.blur(); }catch(_){ } }
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden','true');
    overlay.setAttribute('inert','');
    document.body.style.overflow='';
    requestAnimationFrame(function(){ if (btnToday && btnToday.focus) btnToday.focus(); });
  }
  if (btnClose)  btnClose.addEventListener('click',function(){ closeOverlay(); });
  if (btnCancel) btnCancel.addEventListener('click',function(){ closeOverlay(); });
  window.addEventListener('keydown',function(e){ if(e.key==='Escape') closeOverlay(); });

  function openModalNew(dateISO){
    if (!overlay) return;
    if (modalTitle) modalTitle.textContent='Нова подія';
    overlay.dataset.mode='new'; overlay.dataset.origDate=dateISO; delete overlay.dataset.id;
    if (inputDate)   inputDate.value = dateISO;
    if (inputTime)   inputTime.value = Ev.defaultTime();
    if (inputTitle)  inputTitle.value = '';
    if (inputOwner)  inputOwner.value = '';
    if (inputType)   inputType.value = 'evt';
    if (inputUrgent) inputUrgent.checked = false;
    
    if (inputIncoming)     inputIncoming.value = '';
    if (inputOutgoing)     inputOutgoing.value = '';
    if (inputDescription)  inputDescription.value = '';
    
    setEditModalType(inputType ? inputType.value : 'evt'); applyUrgentClass(); showOverlay();
  }


  function openModalEdit(dateISO,id){
    var arr=Data.getEventsFor(dateISO); var ev=arr.find(function(e){return e.id===id;}); if(!ev) return;
    if (modalTitle) modalTitle.textContent='Редагувати подію';
    if (!overlay) return;
    overlay.dataset.mode='edit'; overlay.dataset.origDate=dateISO; overlay.dataset.id=id;
    if (inputDate)   inputDate.value = dateISO;
    if (inputTime)   inputTime.value = ev.time || '';
    if (inputTitle)  inputTitle.value = ev.title || '';
    if (inputOwner)  inputOwner.value = ev.owner || '';
    if (inputType)   inputType.value = ev.type || 'evt';
    if (inputUrgent) inputUrgent.checked = !!ev.urgent;
    if (inputDone)   inputDone.checked   = !!ev.done;
    
    if (inputIncoming)     inputIncoming.value = ev.incoming_no || '';
    if (inputOutgoing)     inputOutgoing.value = ev.outgoing_no || '';
    if (inputDescription)  inputDescription.value = ev.description || '';

    setEditModalType(inputType ? inputType.value : 'evt'); applyUrgentClass(); showOverlay();
  }

  if (modal) modal.addEventListener('submit',function(e){
    e.preventDefault();
    var newDate = inputDate ? inputDate.value : '';
    if(!newDate || !inputTime || !inputTitle || !inputType) return;
    if(!inputTime.value || !inputTitle.value.trim() || !inputType.value) return;

    var ev = {
      id: (overlay && overlay.dataset.id) ? overlay.dataset.id : Ev.genId(),
      time:  inputTime.value,
      title: inputTitle.value.trim(),
      owner: (inputOwner && inputOwner.value || '').trim(),
      type:  inputType.value,
      urgent: !!(inputUrgent && inputUrgent.checked),
      done:   !!(inputDone && inputDone.checked),
      user_id: 0,

      // NEW:
      incoming_no: (inputIncoming    && inputIncoming.value    || '').trim(),
      outgoing_no: (inputOutgoing    && inputOutgoing.value    || '').trim(),
      description: (inputDescription && inputDescription.value || '').trim()
    };

    var mode     = overlay ? overlay.dataset.mode : 'new';
    var origDate = overlay ? overlay.dataset.origDate : newDate;

    if (mode==='edit'){
      var fromArr=Data.getEventsFor(origDate);
      var idx=Ev.findIndexById(fromArr, ev.id);
      if (idx>-1){
        if (newDate===origDate){
          fromArr[idx]=ev; Data.setEventsFor(origDate, fromArr);
          var c=findCell(origDate); if (c) renderCell(c);
        } else {
          fromArr.splice(idx,1); Data.setEventsFor(origDate, fromArr);
          var toArr=Data.getEventsFor(newDate); toArr.push(ev); Data.setEventsFor(newDate, toArr);
          var c1=findCell(origDate); if (c1) renderCell(c1);
          var c2=findCell(newDate);  if (c2) renderCell(c2);
        }
      }
    } else {
      var arr=Data.getEventsFor(newDate); arr.push(ev); Data.setEventsFor(newDate, arr);
      var c=findCell(newDate); if (c) renderCell(c);
    }
    renderTodayPanel(); closeOverlay();
  });

  /* ===== Позначення подій як виконаних (close_user_id/close_time) ===== */

// Ensure close fields exist on every event (in-place)
function migrateEnsureCloseFields(dayMap) {
  if (!dayMap || typeof dayMap !== 'object') return;
  Object.keys(dayMap).forEach(function (day) {
    var arr = dayMap[day];
    if (!Array.isArray(arr)) return;
    for (var i=0; i<arr.length; i++) {
      var ev = arr[i];
      if (!('close_user_id' in ev)) ev.close_user_id = null;
      if (!('close_time' in ev)) ev.close_time = null;
    }
  });
}

// Helper: is closed?
function isEventClosed(ev) {
  return !!(ev && ev.close_user_id && ev.close_time);
}

// Format closed label
function formatClosedAt(iso) {
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('uk-UA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

// Apply closed styling to an event DOM node (card/label)
// Expects: node is an element representing an event (div, a, etc.)
function applyClosedStyles(node, ev) {
  if (!node || !ev) return;
  if (isEventClosed(ev)) {
    node.classList.add('is-closed');
    // Append closed time text if there's a title container
    var title = node.querySelector('.event-title, .title, [data-role="event-title"]');
    if (title && !title.querySelector('.closed-note')) {
      var span = document.createElement('span');
      span.className = 'closed-note';
      span.style.marginLeft = '8px';
      span.textContent = '(закрито: ' + formatClosedAt(ev.close_time) + ')';
      title.appendChild(span);
    }
  } else {
    node.classList.remove('is-closed');
    var note = node.querySelector('.closed-note');
    if (note) note.remove();
  }
}

// Mark as done / reopen — in-memory + server
// You already have storeAll(dayMap) in backend API; here we'll call a small close endpoint for atomic updates.
function closeEventById(dayMap, eventId, userId) {
  if (!dayMap || !eventId) return Promise.reject(new Error('bad args'));
  var evRef = null, evDay = null, evIdx = -1;

  Object.keys(dayMap).some(function (d) {
    var idx = -1;
    var found = (dayMap[d] || []).some(function (e, i) {
      if (e.id === eventId) { idx = i; return true; }
      return false;
    });
    if (found) { evRef = dayMap[d][idx]; evDay = d; evIdx = idx; return true; }
    return false;
  });

  if (!evRef) return Promise.reject(new Error('not found'));

  var nowIso = new Date().toISOString();
  evRef.close_user_id = userId || 'system';
  evRef.close_time = nowIso;

  // optimistic UI — server sync
  return fetch('/api/events/close', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Accept':'application/json'},
    body: JSON.stringify({ id: eventId, close_user_id: evRef.close_user_id, close_time: evRef.close_time })
  }).then(function (r) {
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  });
}

function reopenEventById(dayMap, eventId) {
  if (!dayMap || !eventId) return Promise.reject(new Error('bad args'));
  var evRef = null;

  Object.keys(dayMap).some(function (d) {
    return (dayMap[d] || []).some(function (e) {
      if (e.id === eventId) { evRef = e; return true; }
      return false;
    });
  });

  if (!evRef) return Promise.reject(new Error('not found'));

  evRef.close_user_id = null;
  evRef.close_time = null;

  return fetch('/api/events/close', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Accept':'application/json'},
    body: JSON.stringify({ id: eventId, close_user_id: null, close_time: null })
  }).then(function (r) {
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  });
}

// Export small API into CalendarApp.ui if present (keeps your global style)
if (window.CalendarApp && window.CalendarApp.ui) {
  window.CalendarApp.ui.isEventClosed = isEventClosed;
  window.CalendarApp.ui.applyClosedStyles = applyClosedStyles;
  window.CalendarApp.ui.migrateEnsureCloseFields = migrateEnsureCloseFields;
  window.CalendarApp.ui.closeEventById = closeEventById;
  window.CalendarApp.ui.reopenEventById = reopenEventById;
}
/* ===== Інфо ===== */
  function setInfoModalType(t){
    if (!infoModal) return;
    infoModal.classList.remove('type-mi','type-nas','type-evt','type-other');
    infoModal.classList.add(t==='mi'?'type-mi':t==='nas'?'type-nas':t==='evt'?'type-evt':'type-other');
  }
  function openInfo(dateISO,id){ 
    var arr=Data.getEventsFor(dateISO); var ev=arr.find(function(e){return e.id===id;}); if(!ev) return;
    var html=
              '<div class="row">' +
                '<div><strong>Дата:</strong> '+Ev.formatISO(dateISO)+' ('+weekdayShortFmt.format(new Date(dateISO))+')</div>'+
                '<div><strong>Час:</strong> '+(ev.time||'')+'</div>'+
              '</div>' +

              '<div class="row">' +
                '<div><strong>Тип:</strong> '+Ev.labelForType(ev.type)+'</div>'+
                '<div style="position:relative;margin-right:1em;">' +
                  '<strong>Виконана:</strong> '+(ev.done?'так':'ні') +
                  (ev.urgent ? '<span style="top:-36px;" class="flag-urgent"><span class="icon"><svg class="icon"><use href="#i-fire-clock"></use></svg></span></span>' : '') +
                  // '<span class="urgent-icon">🔥</span>' + 
                '</div>' +
              '</div>' +
              '<div><strong>Назва:</strong> '+Ev.escapeHtml(ev.title||'')+'</div>'+
              '<div><strong>Відповідальний:</strong> '+Ev.escapeHtml(ev.owner||'—')+'</div>'+
              
              '<div><strong>Терміновість:</strong> '+(ev.urgent?'так':'ні')+'</div>' +

              (ev.incoming_no ? '<div><strong>Вхідний №:</strong> '+Ev.escapeHtml(ev.incoming_no||'—')+'</div>' : '') +
              (ev.outgoing_no ? '<div><strong>Вихідний №:</strong> '+Ev.escapeHtml(ev.outgoing_no||'—')+'</div>' : '') + 
              (ev.description ? ('<div><strong>Опис:</strong><br><div class="container auto">'+Ev.escapeHtml(ev.description)+'</div></div>') : '');

    if (infoContent) infoContent.innerHTML=html;
      setInfoModalType(ev.type);
    if (infoOverlay){
      infoOverlay.classList.add('show'); infoOverlay.setAttribute('aria-hidden','false'); infoOverlay.removeAttribute('inert');
      document.body.style.overflow='hidden';

      var el = document.querySelector('#editEvBtn');
      el.setAttribute('data-id',id);
      el.addEventListener('click',function(e){ closeInfo(); e.stopPropagation(); var eid=e.currentTarget.getAttribute('data-id'); openModalEdit(dateISO,eid); });
      // infoTitle
      // item.addEventListener('click',function(e){ e.stopPropagation(); var eid=e.currentTarget.getAttribute('data-id'); openModalEdit(dateISO,eid); });
    }
  }
  function closeInfo(){
    if (!infoOverlay) return;
    if (infoOverlay.contains(document.activeElement)) { try{ document.activeElement.blur(); }catch(_){} }
    infoOverlay.classList.remove('show'); infoOverlay.setAttribute('aria-hidden','true'); infoOverlay.setAttribute('inert','');
    document.body.style.overflow='';
  }
  if (infoClose) infoClose.addEventListener('click',function(){ closeInfo(); });
  if (infoOk)    infoOk.addEventListener('click',function(){ closeInfo(); });

  /* ===== Чат (демо «ВКЗ») ===== */
  function openChat(){
    if (!chatOverlay || !chatContent) return;
    var todayISO = Ev.toISODate(today);
    var list = Data.getEventsFor(todayISO).filter(function(e){
      return (e.title||'').toLowerCase().includes('вкз');
    }).sort(function(a,b){return (a.time||'').localeCompare(b.time||'');});
    chatContent.innerHTML='';
    if(list.length===0){ chatContent.textContent='Події «ВКЗ» на сьогодні не знайдені.'; }
    else{
      list.forEach(function(ev){
        var card=document.createElement('div');
        card.className='chat-card'+(ev.urgent?' urgent':'');
        if(ev.urgent){
          var flag=document.createElement('span'); flag.className='flag-urgent';
          var icon=document.createElement('span'); icon.className='icon'; icon.innerHTML ='<svg class="icon"><use href="#i-fire-clock"></use></svg>';
          // '🔥';
          flag.appendChild(icon); card.appendChild(flag);
        }
        card.innerHTML+='<div><strong>'+Ev.escapeHtml(ev.time||'')+' • '+Ev.escapeHtml(ev.title)+'</strong></div>'+
                        '<div style="color:var(--muted)">Відповідальний: '+Ev.escapeHtml(ev.owner||'—')+' • Тип: '+Ev.labelForType(ev.type)+'</div>'+
                        '<div>Пояснення: коротка підготовка до «ВКЗ», при потребі — матеріали/довідки.</div>';
        chatContent.appendChild(card);
      });
    }
    chatOverlay.classList.add('show'); chatOverlay.setAttribute('aria-hidden','false'); chatOverlay.removeAttribute('inert');
    document.body.style.overflow='hidden';
  }
  if (btnChat)   btnChat.addEventListener('click',openChat);
  if (chatClose) chatClose.addEventListener('click',function(){ chatOverlay.classList.remove('show'); chatOverlay.setAttribute('aria-hidden','true'); chatOverlay.setAttribute('inert',''); document.body.style.overflow=''; });
  if (chatOk)    chatOk.addEventListener('click',function(){ chatOverlay.classList.remove('show'); chatOverlay.setAttribute('aria-hidden','true'); chatOverlay.setAttribute('inert',''); document.body.style.overflow=''; });

  /* ===== Рендер календаря ===== */
  var cells=[], quarterHas={}, hourHoverCount={}, earlyOpen=false, lateOpen=false;

  function renderCalendar(){
    if (!grid) return;
    var monthName=monthFmt.format(new Date(state.year,state.month,1));
    if (monthLabel) monthLabel.textContent = (monthName.charAt(0).toUpperCase()+monthName.slice(1))+' '+state.year;

    if (weekdaysEl && weekdaysEl.children.length===0){
      var mondayAnchor=new Date(Date.UTC(2021,10,1));
      for(var i=0;i<7;i++){
        var d=new Date(mondayAnchor.getTime()+i*86400000);
        var w=document.createElement('div'); w.className='weekday';
        w.textContent=weekdayShortFmt.format(d).toUpperCase();
        weekdaysEl.appendChild(w);
      }
    }

    grid.innerHTML=''; cells=[];
    var first=((new Date(state.year,state.month,1)).getDay()+6)%7;
    var dim=new Date(state.year,state.month+1,0).getDate();
    for(var i2=0;i2<first;i2++){ var pad=document.createElement('div'); pad.className='cell pad'; pad.setAttribute('aria-hidden','true'); grid.appendChild(pad); }
    for(var day=1; day<=dim; day++){
      var d2=new Date(state.year,state.month,day);
      var iso=Ev.toISODate(d2);
      var cell=document.createElement('div'); cell.className='cell'; cell.setAttribute('role','gridcell'); cell.setAttribute('aria-label', longHeaderFmt.format(d2)); cell.dataset.date=iso;

      var head=document.createElement('div'); head.className='cell-head';
      var hplus=document.createElement('div'); hplus.className='cell-head-plus'; hplus.textContent=String('+');
      var dn=document.createElement('div'); dn.className='day-num'; dn.textContent=String(day);
      head.appendChild(dn); head.appendChild(hplus); cell.appendChild(head);
      var list=document.createElement('div'); list.className='events'; cell.appendChild(list);

      var w=((d2.getDay()+6)%7); if(w>=5) cell.classList.add('weekend'); if(Ev.sameDate(d2,today)) cell.classList.add('today');

      cell.addEventListener('click', function(ev){
        var c=ev.currentTarget; var iso2=c.dataset.date; var headEl=c.querySelector('.cell-head'); var listEl=c.querySelector('.events');
        if(ev.target===c||ev.target===headEl||ev.target===listEl||ev.target===headEl.firstChild){ openModalNew(iso2); }
      });
      // заміна на інфо
      // cell.addEventListener('click',function(){ openInfo(iso2,ev.id); });

      cell.addEventListener('dragenter',function(e){ e.preventDefault(); this.classList.add('drop-target'); });
      cell.addEventListener('dragover', function(e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; this.classList.add('drop-target'); });
      cell.addEventListener('dragleave',function(){ this.classList.remove('drop-target'); });
      cell.addEventListener('drop',function(e){
        e.preventDefault(); this.classList.remove('drop-target');
        try{
          var payload=e.dataTransfer.getData('text/calendar-event'); if(!payload) return;
          var obj=JSON.parse(payload); var fromDate=obj.fromDate; var id=obj.id; var toDate=this.dataset.date; if(!fromDate||!id||toDate===fromDate) return;
          var fromArr=Data.getEventsFor(fromDate); var idx=Ev.findIndexById(fromArr,id); if(idx===-1) return;
          var moved=fromArr.splice(idx,1)[0]; Data.setEventsFor(fromDate,fromArr);
          var toArr=Data.getEventsFor(toDate); toArr.push(moved); Data.setEventsFor(toDate,toArr);
          var cFrom=cells.find(function(c){return c.dataset.date===fromDate;}); if(cFrom) renderCell(cFrom);
          renderCell(this); renderTodayPanel();
        }catch(err){ console.warn('drop failed',err); }
      });

      grid.appendChild(cell); cells.push(cell);
    }
    renderAllCells(); renderTodayPanel();
  }

  function renderAllCells(){ for(var i=0;i<cells.length;i++){ renderCell(cells[i]); } }
  function findCell(dateISO){ for(var i=0;i<cells.length;i++){ if(cells[i].dataset.date===dateISO) return cells[i]; } return null; }

  function renderCell(cell){
    var dateISO=cell.dataset.date; var list=cell.querySelector('.events'); list.innerHTML='';
    var events=Data.getEventsFor(dateISO).slice().sort(function(a,b){ return (a.time||'').localeCompare(b.time||''); });
    var matcher=Ev.buildMatcher(currentType, filterText ? filterText.value : '');
    var filtered=events.filter(matcher);

    for(var i=0;i<filtered.length;i++){
      var ev=filtered[i];
      var item=document.createElement('div'); item.className='event '+Ev.typeToClass(ev.type)+(ev.urgent?' urgent':''); if (ev && ev.done) { try { item.classList.add('done'); } catch(_){ item.className += ' done'; } } item.setAttribute('draggable','true'); item.setAttribute('data-id',ev.id);
      item.addEventListener('dragstart',function(e){
        var d=e.currentTarget; var parent=d.closest('.cell'); var dt=e.dataTransfer; var eid=d.getAttribute('data-id'); var from=parent?parent.dataset.date:null;
        d.classList.add('dragging'); dt.effectAllowed='move'; dt.setData('text/calendar-event', JSON.stringify({fromDate:from,id:eid}));
      });
      item.addEventListener('dragend',function(e){ e.currentTarget.classList.remove('dragging'); });

      var bar=document.createElement('div'); bar.className='bar';
      var time=document.createElement('div'); time.className='event-time'; time.textContent=ev.time||'';
      var title=document.createElement('div'); title.className='event-title';

      if(ev.urgent){
        var flag=document.createElement('span'); flag.className='flag-urgent';
        var icon=document.createElement('span'); icon.className='icon'; icon.innerHTML ='<svg class="icon"><use href="#i-fire-clock"></use></svg>';
          // '🔥';
        flag.appendChild(icon); item.appendChild(flag);
      }
      title.appendChild(document.createTextNode(ev.title||''));
     

      var del=document.createElement('button'); del.className='event-btn'; del.type='button'; del.setAttribute('aria-label','Видалити'); del.textContent='×';
      var owner=document.createElement('div'); owner.className='event-owner'; owner.textContent=Ev.labelForType(ev.type)+(ev.owner?(' • Відповідальний: '+ev.owner):'');

      del.addEventListener('click',function(e){
        e.stopPropagation(); var eid=e.currentTarget.parentElement.getAttribute('data-id');
        var arr=Data.getEventsFor(dateISO); var idx=Ev.findIndexById(arr,eid); if(idx>-1){ arr.splice(idx,1); Data.setEventsFor(dateISO,arr); renderCell(cell); renderTodayPanel(); }
      });
      
      item.addEventListener('click',function(e){ e.stopPropagation(); var eid=e.currentTarget.getAttribute('data-id'); openInfo(dateISO,eid); });

      item.appendChild(bar);
      item.appendChild(time);
      item.appendChild(title);
      // item.appendChild(del);
      item.appendChild(owner);
      item.setAttribute('title', ev.title);
      list.appendChild(item);
    }
  }

  /* ===== Таймлайн «Сьогодні» ===== */
  if (btnEarly) btnEarly.addEventListener('click',function(){ earlyOpen=!earlyOpen; renderTodayPanel(); });
  if (btnLate)  btnLate.addEventListener('click',function(){ lateOpen=!lateOpen; renderTodayPanel(); });

  function renderTodayPanel(){
    if (!todayTimeline) return;
    earlyTimeline.innerHTML=''; todayTimeline.innerHTML=''; lateTimeline.innerHTML='';
    hourHoverCount={}; quarterHas={};

    var todayISO=Ev.toISODate(today);
    var nextISO =Ev.toISODate(new Date(today.getFullYear(),today.getMonth(),today.getDate()+1));

    var matcher=Ev.buildMatcher(currentType, filterText ? filterText.value : '');
    var allToday=Data.getEventsFor(todayISO).filter(matcher).sort(function(a,b){return (a.time||'').localeCompare(b.time||'');});
    var allNext =Data.getEventsFor(nextISO ).filter(matcher).sort(function(a,b){return (a.time||'').localeCompare(b.time||'');});

    quarterHas[todayISO]={}; quarterHas[nextISO]={};
    for(var i=0;i<allToday.length;i++){ var p=(allToday[i].time||'00:00').split(':'), hh=+p[0]||0, mm=+p[1]||0; if(mm!==0) quarterHas[todayISO][hh]=true; }
    for(var j=0;j<allNext.length;j++){ var q=(allNext[j].time||'00:00').split(':'), h2=+q[0]||0, m2=+q[1]||0; if(m2!==0) quarterHas[nextISO][h2]=true; }

    var earlyCount=allToday.filter(function(e){ var h=(+((e.time||'00:00').split(':')[0])||0); return h<6; }).length;
    var lateCount =allNext .filter(function(e){ var h=(+((e.time||'00:00').split(':')[0])||0); return h<6; }).length;
    var earlyCountEl=$('earlyCount'), lateCountEl=$('lateCount');
    if (earlyCountEl) earlyCountEl.textContent = earlyCount?('подій: '+earlyCount):'';
    if (lateCountEl)  lateCountEl.textContent  = lateCount ?('подій: '+lateCount) :'';
    if (earlyWrap) earlyWrap.classList.toggle('open',earlyOpen);
    if (lateWrap)  lateWrap.classList.toggle('open',lateOpen);

    function buildByQuarter(list){
      var map={}; for(var h=0;h<24;h++){ for(var m=0;m<60;m+=15){ map[Ev.pad2(h)+':'+Ev.pad2(m)]=[]; } }
      for(var k=0;k<list.length;k++){
        var ev=list[k]; var parts=(ev.time||'00:00').split(':'), H=+parts[0]||0, M=+parts[1]||0;
        var key=Ev.pad2(H)+':'+Ev.pad2(Math.floor(M/15)*15); map[key].push(ev);
      } return map;
    }
    var byQToday=buildByQuarter(allToday), byQNext=buildByQuarter(allNext);
    var tlAll={}; tlAll[todayISO]=earlyTimeline; tlAll[todayISO]=todayTimeline; tlAll[nextISO]=lateTimeline;

    function expandHour(dateISO,hour){
      ['15','30','45'].forEach(function(min){
        // var elq=(tlAll[dateISO]||document).querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+hour+'"][data-min="'+min+'"]');
        var elq=(document).querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+hour+'"][data-min="'+min+'"]');
        if(elq) elq.style.display='grid';
      });
    }
    function collapseHour(dateISO,hour){
      if(quarterHas[dateISO] && quarterHas[dateISO][hour]) return;
      ['15','30','45'].forEach(function(min){
        var elq=(document).querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+hour+'"][data-min="'+min+'"]');
        if(elq) elq.style.display='none';
      });
    }
    window.foldAllQuarters=function(){
      Object.keys(tlAll).forEach(function(dateISO){
        for(var h=0;h<24;h++){
          var keep=quarterHas[dateISO] && quarterHas[dateISO][h];
          ['15','30','45'].forEach(function(min){
            var elq=tlAll[dateISO].querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+h+'"][data-min="'+min+'"]');
            if(elq) elq.style.display = keep?'grid':'none';
          });
        }
      });
    };

    function renderGroup(tl,dateISO,startHour,endHour){
      if(!tl) return;
      for(var h=startHour; h<endHour; h++){
        for(var m=0; m<60; m+=15){
          var slot=document.createElement('div'); slot.className='slot quarter'; slot.dataset.date=dateISO; slot.dataset.hour=String(h); slot.dataset.min=String(m);

          slot.addEventListener('dragenter',function(e){
            e.preventDefault(); this.classList.add('drop-target');
            var HH=parseInt(this.dataset.hour,10)||0; var key=this.dataset.date+'|'+HH;
            hourHoverCount[key]=(hourHoverCount[key]||0)+1;
            if(this.dataset.min==='0'){ expandHour(this.dataset.date,HH); }
          });
          slot.addEventListener('dragover',function(e){ e.preventDefault(); this.classList.add('drop-target'); e.dataTransfer.dropEffect='move'; });
          slot.addEventListener('dragleave',function(){
            this.classList.remove('drop-target');
            var HH=parseInt(this.dataset.hour,10)||0; var key=this.dataset.date+'|'+HH;
            hourHoverCount[key]=Math.max((hourHoverCount[key]||1)-1,0);
            var date=this.dataset.date;
            setTimeout(function(){ if(hourHoverCount[key]===0 && !(quarterHas[date]&&quarterHas[date][HH])){ collapseHour(date,HH); } },60);
          });
          slot.addEventListener('drop',function(e){
            e.preventDefault(); this.classList.remove('drop-target');
            var HH=parseInt(this.dataset.hour,10)||0; var key=this.dataset.date+'|'+HH;
            hourHoverCount[key]=Math.max((hourHoverCount[key]||1)-1,0);
            try{
              var payload=e.dataTransfer.getData('text/calendar-event'); if(!payload) return;
              var obj=JSON.parse(payload); var fromDate=obj.fromDate; var id=obj.id;
              var nh=parseInt(this.dataset.hour,10)||0; var nm=parseInt(this.dataset.min,10)||0; var newTime=Ev.pad2(nh)+':'+Ev.pad2(nm);
              var targetDate=this.dataset.date;
              if(fromDate && fromDate!==targetDate){
                var fromArr=Data.getEventsFor(fromDate); var idx=Ev.findIndexById(fromArr,id); if(idx===-1) return;
                var moved=fromArr.splice(idx,1)[0]; moved.time=newTime; Data.setEventsFor(fromDate,fromArr);
                var toArr=Data.getEventsFor(targetDate); toArr.push(moved); Data.setEventsFor(targetDate,toArr);
                var cFrom=findCell(fromDate); if(cFrom) renderCell(cFrom);
              }else{
                var arr=Data.getEventsFor(targetDate);
                arr = global.CalendarApp.events.updateEventTimeInArray(arr, id, newTime);
                Data.setEventsFor(targetDate, arr);
              }
              var c1=findCell(targetDate); if(c1) renderCell(c1);
              renderTodayPanel();
            }catch(err){ console.warn('drop quarter',err); }
          });

          var time=document.createElement('div'); time.className='time'; time.textContent=(m===0?(Ev.pad2(h)+':00'):(':'+Ev.pad2(m))); if(m!==0) time.classList.add('qmin');
          var items=document.createElement('div'); items.className='items';

          var key=Ev.pad2(h)+':'+Ev.pad2(m);
          var arr=(dateISO===Ev.toISODate(today)? byQToday[key] : byQNext[key])||[];
          arr.forEach(function(ev){
            var row=document.createElement('div'); row.className='item'+(ev.urgent?' urgent':''); if (ev && ev.done) { try { row.classList.add('done'); } catch(_){ row.className += ' done'; } } row.dataset.date=dateISO; row.dataset.id=ev.id; row.setAttribute('draggable','true');
            row.addEventListener('dragstart',function(e){ var id=e.currentTarget.dataset.id; var d=e.currentTarget.dataset.date; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/calendar-event', JSON.stringify({fromDate:d,id:id})); });
            if(ev.urgent){ var flag=document.createElement('span'); flag.className='flag-urgent'; var icon=document.createElement('span'); icon.className='icon'; icon.innerHTML ='<svg class="icon"><use href="#i-fire-clock"></use></svg>';
          // '🔥';
                flag.appendChild(icon); row.appendChild(flag); }
            var dot=document.createElement('span'); dot.className='dot '+(ev.type||'evt'); row.appendChild(dot);
            var label=(ev.time||'')+' — '+ev.title+(ev.owner?(' • '+ev.owner):''); row.appendChild(document.createTextNode(label));
            row.addEventListener('click',function(){ openInfo(dateISO,ev.id); });
            items.appendChild(row);
          });

          if(m!==0){ var show=(quarterHas[dateISO]&&quarterHas[dateISO][h])?true:false; slot.style.display=show?'grid':'none'; }
          slot.appendChild(time); slot.appendChild(items); tl.appendChild(slot);
        }
      }
    }

    var byQToday=buildByQuarter(allToday);
    var byQNext =buildByQuarter(allNext);

    if(earlyOpen) renderGroup(earlyTimeline,todayISO,0,6);
    renderGroup(todayTimeline,todayISO,6,24);
    if(lateOpen)  renderGroup(lateTimeline,nextISO,0,6);
  }

  /* ===== Ініціалізація ===== */
  function migrateEnsureIds(){
    var s = Data.readStore();
    var changed=false;
    for (var k in s){
      if(Object.prototype.hasOwnProperty.call(s,k)){
        var res = Ev.migrateArray(s[k]);
        s[k]=res.list; changed = changed || res.changed;
      }
    }
    if (changed) Data.writeStore(s);
  }

  function init(){
    // Рендер каркасу
    renderCalendar();
    // Завантаження й первинний рендер
    Data.serverLoadStore().then(function(data){
      Data._setCache( Data.ensureStoreShape(data) );
      migrateEnsureIds();
      renderAllCells(); renderTodayPanel();
    });
  }

  // Експорт UI API (якщо буде потрібно з інших скриптів)
  global.CalendarApp.ui.init = init;
  global.CalendarApp.ui.openModalNew  = openModalNew;
  global.CalendarApp.ui.openModalEdit = openModalEdit;
  global.CalendarApp.ui.openInfo = openInfo; 

  // Автостарт
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
