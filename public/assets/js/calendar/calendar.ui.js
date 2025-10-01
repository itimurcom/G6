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


    var todayLabel     = $('todayLabel'); // +
    var todayPanelDate = $('todayPanelDate'); // +
  
  var filterText      = $('filterText'); // 12

  var quickFilters = $('quickFilters');

  // Модалка редагування
  var overlay      = $('eventOverlay'); // 29
  var modal        = $('eventModal'); // 19

  var inputDate    = $('inputDate'); // 11
  var inputTime    = $('inputTime'); // 9
  var inputSpanDays = $('inputSpanDays'); // 11
  var inputTitle   = $('inputTitle'); // 11

  var inputOwner   = $('inputOwner'); //8
  var inputType    = $('inputType'); // 16
  var inputUrgent  = $('inputUrgent'); // 12
  var inputDone    = $('inputDone'); // 10

  var editModal    = overlay ? overlay.querySelector('.modal') : null; // 7

  // New optional fields
  var inputIncoming     = $('inputIncoming');    // Вхідний номер // 8
  var inputOutgoing     = $('inputOutgoing');    // Вихідний номер // 8
  var inputDescription  = $('inputDescription'); // Опис (textarea) // 8

  // Інфо-модалка
  var infoOverlay = $('infoOverlay'); // 13
  var infoModal   = infoOverlay ? infoOverlay.querySelector('.modal') : null;

  // Форматери
  var monthFmt        = new Intl.DateTimeFormat(locale,{month:'long'});
  var weekdayShortFmt = new Intl.DateTimeFormat(locale,{weekday:'short'});
  var longHeaderFmt   = new Intl.DateTimeFormat(locale,{weekday:'short',day:'numeric',month:'long',year:'numeric'});

  if (todayLabel)     todayLabel.textContent     = longHeaderFmt.format(today).replace('.','');
  if (todayPanelDate) todayPanelDate.textContent = longHeaderFmt.format(today).replace('.','');

  /* ===== Фільтри типів/пошуку ===== */
  function updateTypeButtons(){
    var btnTypeMi       = $('btnTypeMi');
    var btnTypeNas      = $('btnTypeNas');
    var btnTypeEvt      = $('btnTypeEvt');
    var btnTypeOther    = $('btnTypeOther');
    var btnTypeReset    = $('btnTypeReset');

    if (!btnTypeMi) return;
    btnTypeMi.classList.toggle('active',currentType==='mi');
    btnTypeNas.classList.toggle('active',currentType==='nas');
    btnTypeEvt.classList.toggle('active',currentType==='evt');
    btnTypeOther.classList.toggle('active',currentType==='other');
    if (btnTypeReset) btnTypeReset.style.display=(currentType==='all')?'none':'inline-grid';
  }
  function setTypeFilter(t){ currentType=t||'all'; updateTypeButtons(); withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} }); }
    var btnClearFilters = $('btnClearFilters');
    var btnTypeMi       = $('btnTypeMi');
    var btnTypeNas      = $('btnTypeNas');
    var btnTypeEvt      = $('btnTypeEvt');
    var btnTypeOther    = $('btnTypeOther');
    var btnTypeReset    = $('btnTypeReset');

  if (btnTypeMi)    btnTypeMi.addEventListener('click',function(){ setTypeFilter('mi'); });
  if (btnTypeNas)   btnTypeNas.addEventListener('click',function(){ setTypeFilter('nas'); });
  if (btnTypeEvt)   btnTypeEvt.addEventListener('click',function(){ setTypeFilter('evt'); });
  if (btnTypeOther) btnTypeOther.addEventListener('click',function(){ setTypeFilter('other'); });
  if (btnTypeReset) btnTypeReset.addEventListener('click',function(){ setTypeFilter('all'); });
  if (filterText)   filterText.addEventListener('input',function(){ withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} }); });
  if (btnClearFilters) btnClearFilters.addEventListener('click',function(){ if(filterText) filterText.value=''; setTypeFilter('all'); });
  if (quickFilters) quickFilters.addEventListener('click',function(e){
    var b=e.target && e.target.closest ? e.target.closest('button[data-type]') : null;
    if(!b) return;
    setTypeFilter(b.getAttribute('data-type'));
    if (filterText) filterText.value = b.getAttribute('data-text') || '';
    withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} });
  });

  /* ===== Навігація місяців ===== */
  function changeMonth(delta) {
    var m=state.month+delta, y=state.year;
    if(m<0){m+=12;y--;} if(m>11){m-=12;y++;}
    state.month=m; state.year=y; renderCalendar();
  }

    var btnPrev = $('btnPrev');
    var btnNext = $('btnNext');
    var btnToday= $('btnToday');
    var btnExport = $('btnExport');
    var btnImport = $('btnImport');
    var filePicker= $('filePicker');
    var btnClose     = $('btnClose');
    var btnCancel    = $('btnCancel');
  if (btnPrev)  btnPrev.addEventListener('click',function(){ changeMonth(-1); });
  if (btnNext)  btnNext.addEventListener('click',function(){ changeMonth(1); });
  if (btnToday) btnToday.addEventListener('click',function(){ state.year=today.getFullYear(); state.month=today.getMonth(); renderCalendar(); });
  if (btnClose)  btnClose.addEventListener('click',function(){ closeOverlay(); });
  if (btnCancel) btnCancel.addEventListener('click',function(){ closeOverlay(); });
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
        withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} });
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
    var urgentSwitch = $('urgentSwitch');

    if (!editModal || !urgentSwitch || !inputUrgent) return;
    editModal.classList.remove('urgent');
    urgentSwitch.classList.toggle('active', !!inputUrgent.checked);
  }
  function applyDoneClass(){
    var doneSwitch   = $('doneSwitch');

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
    // [css стрибки] overflow hidden disabled;
    setTimeout(function(){ if(inputTitle) inputTitle.focus(); },0);
  }
  function closeOverlay(){
    if (!overlay) return;
    // Blur anything inside the overlay to avoid scroll jumps
    if (overlay.contains(document.activeElement)) { try{ document.activeElement.blur(); }catch(_){ } }
    var x = window.scrollX, y = window.scrollY;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden','true');
    overlay.setAttribute('inert','');
    // return focus back to the opener without scrolling
    requestAnimationFrame(function(){
      try{ window.scrollTo(x,y); }catch(_){}
      try{ __lastFocusEl && __lastFocusEl.focus && __lastFocusEl.focus({preventScroll:true}); }catch(_){}
    });
  }
  window.addEventListener('keydown',function(e){ if(e.key==='Escape'){ try{ closeOverlay(); }catch(_){ } try{ closeInfo(); }catch(_){ } } });

  function openModalNew(dateISO){
    var modalTitle   = $('modalTitle');
    var inputEndDate = $('inputEndDate');

  try{ __lastFocusEl = document.activeElement; }catch(_){}
    if (!overlay) return;
    if (modalTitle) modalTitle.textContent='Нова подія';
    overlay.dataset.mode='new'; overlay.dataset.origDate=dateISO; delete overlay.dataset.id;
    if (inputDate)   inputDate.value = dateISO;
    if (inputTime)   inputTime.value = Ev.defaultTime();
    
    if (inputEndDate) inputEndDate.value = '';
    if (inputSpanDays) inputSpanDays.value = '';
if (inputTitle)  inputTitle.value = '';
    if (inputOwner)  inputOwner.value = '';
    if (inputType)   inputType.value = 'evt';
    if (inputUrgent) inputUrgent.checked = false;
    
    if (inputIncoming)     inputIncoming.value = '';
    if (inputOutgoing)     inputOutgoing.value = '';
    if (inputDescription)  inputDescription.value = '';
    
    setEditModalType(inputType ? inputType.value : 'evt'); applyUrgentClass(); showOverlay();
  }

  function openModalEdit(dateISO, id){
    var modalTitle   = $('modalTitle');

try{ __lastFocusEl = document.activeElement; }catch(_){}
  if (!overlay) return;
  // Find event strictly from its start day
  var arr = Data.getEventsFor(dateISO) || [];
  var ev  = arr.find(function(e){ return e.id===id; });
  if (!ev) return;

  // Prefill span days (inclusive, UTC)
  if (inputSpanDays){
    var ed = ev.end_date || '';
    try{
      if (ed){
        var __a=dateISO.split('-').map(Number);
        var __b=ed.split('-').map(Number);
        var ds=new Date(Date.UTC(__a[0],__a[1]-1,__a[2]));
        var de=new Date(Date.UTC(__b[0],__b[1]-1,__b[2]));
        var diff = Math.round((de-ds)/86400000) + 1; // inclusive
        inputSpanDays.value = (diff>0) ? String(diff) : '1';
      } else {
        inputSpanDays.value = '1';
      }
    } catch(_){ inputSpanDays.value = '1'; }
  }
try{ __lastFocusEl = document.activeElement; }catch(_){}
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

  
if (modal) modal.addEventListener('submit', function(e){
    e.preventDefault();

    // Native validity: if invalid, show browser hints and keep modal open
    try {
      if (modal && typeof modal.checkValidity === 'function' && !modal.checkValidity()) {
        if (typeof modal.reportValidity === 'function') modal.reportValidity();
        return;
      }
    } catch(_){}

    var newDate = inputDate ? inputDate.value : '';
    if (!newDate) return;

    // Build event payload
    var ev = {
      end_date: (function(){
        var v = (inputSpanDays && inputSpanDays.value!=='') ? parseInt(inputSpanDays.value,10) : NaN;
        var d = (inputDate && inputDate.value) ? inputDate.value : '';
        if (!isNaN(v) && v>1 && d){
          var a=d.split('-').map(Number);
          var o=new Date(Date.UTC(a[0],a[1]-1,a[2]));
          o.setUTCDate(o.getUTCDate()+(v-1));
          return o.toISOString().slice(0,10);
        }
        return null;
      })(),
      id: (overlay && overlay.dataset.id) ? overlay.dataset.id : Ev.genId(),
      time:  (inputTime && inputTime.value) ? inputTime.value : '',
      title: (inputTitle && inputTitle.value) ? inputTitle.value.trim() : '',
      owner: (inputOwner && inputOwner.value || '').trim(),
      type:  (inputType && inputType.value) ? inputType.value : 'evt',
      urgent: !!(inputUrgent && inputUrgent.checked),
      done:   !!(inputDone && inputDone.checked),
      incoming_no: (inputIncoming    && inputIncoming.value    || '').trim(),
      outgoing_no: (inputOutgoing    && inputOutgoing.value    || '').trim(),
      description: (inputDescription && inputDescription.value || '').trim()
    };

    // Minimal guards
    if (!ev.title) return;
    if (!ev.type) ev.type = 'evt';

    var mode     = overlay ? overlay.dataset.mode : 'new';
    var origDate = overlay ? overlay.dataset.origDate : newDate;

    try {
      if (mode==='edit'){
        var fromArr = Data.getEventsFor(origDate);
        var idx     = Ev.findIndexById(fromArr, ev.id);
        if (idx>-1){
          if (newDate===origDate){
            fromArr[idx] = ev;
            Data.setEventsFor(origDate, fromArr);
          } else {
            fromArr.splice(idx,1);
            Data.setEventsFor(origDate, fromArr);
            var toArr = Data.getEventsFor(newDate);
            toArr.push(ev);
            Data.setEventsFor(newDate, toArr);
          }
        }
      } else {
        var arr = Data.getEventsFor(newDate);
        arr.push(ev);
        Data.setEventsFor(newDate, arr);
      }
      // Rerender everything in a stable scroll frame
      withStableScroll(function(){
        try {
          renderAllCells();
          if (typeof renderTodayPanel === 'function') renderTodayPanel();
        } catch(_){}
      });
    } catch(err){
      console.warn('submit/save failed', err);
      // If saving failed, keep modal open so user sees state
      return;
    }

    // Close the modal AFTER successful save/rerender
    closeOverlay();
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
    var infoContent = $('infoContent');

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
      // [css стрибки] overflow hidden disabled;

      var el = document.querySelector('#editEvBtn');
      el.setAttribute('data-id',id);
      el.addEventListener('click',function(e){ closeInfo(); e.stopPropagation(); var eid=e.currentTarget.getAttribute('data-id'); openModalEdit(this.getAttribute('data-start')||dateISO, eid); });
      // infoTitle
      // item.addEventListener('click',function(e){ e.stopPropagation(); var eid=e.currentTarget.getAttribute('data-id'); openModalEdit(this.getAttribute('data-start')||dateISO, eid); });
    }
  }

  function closeInfo(){
    if (!infoOverlay) return;
    if (infoOverlay.contains(document.activeElement)) { try{ document.activeElement.blur(); }catch(_){} }
    infoOverlay.classList.remove('show'); infoOverlay.setAttribute('aria-hidden','true'); infoOverlay.setAttribute('inert','');
    // [css стрибки] no-op: restore not needed
  }

  var infoClose   = $('infoClose');
  var infoOk      = $('infoOk');
  if (infoClose) infoClose.addEventListener('click',function(){ closeInfo(); });
  if (infoOk)    infoOk.addEventListener('click',function(){ closeInfo(); });

  /* ===== Чат (демо «ВКЗ») ===== */
  function openChat(){
    // Чат
    var btnChat     = $('btnChat');
    var chatOverlay = $('chatOverlay');
    var chatClose   = $('chatClose');
    var chatOk      = $('chatOk');
    var chatContent = $('chatContent');

    if (!chatOverlay || !chatContent) return;
    var todayISO = Ev.toISODate(today);
    var list = Data.getEventsFor(todayISO).filter(function(e){
      return (e.title||'').toLowerCase().includes('вкз');
    }).sort(function(a,b){ function toM(t){ var p=String(t||'00:00').split(':'); var h=+p[0]||0, m=+p[1]||0; return h*60+m; } var am=toM(a.time), bm=toM(b.time); if (am!==bm) return am-bm; var u=(b.urgent|0)-(a.urgent|0); if (u) return u; return (a.title||'').localeCompare(b.title||''); });
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
    // [css стрибки] overflow hidden disabled;
  if (btnChat)   btnChat.addEventListener('click',openChat);
  if (chatClose) chatClose.addEventListener('click', function(){ chatOverlay.classList.remove('show'); chatOverlay.setAttribute('aria-hidden','true'); chatOverlay.setAttribute('inert',''); });
  if (chatOk) chatOk.addEventListener('click', function(){ chatOverlay.classList.remove('show'); chatOverlay.setAttribute('aria-hidden','true'); chatOverlay.setAttribute('inert',''); });
  }

/* ===== Фокус та стабільний скрол ===== */
var __lastFocusEl = null;
function withStableScroll(fn){
  var x = window.scrollX, y = window.scrollY;
  try { fn && fn(); } catch(e){ console.warn('withStableScroll failed', e); }
  try { window.scrollTo(x, y); } catch(_){}
}
/* ===== Рендер календаря ===== */
  var cells=[], quarterHas={}, hourHoverCount={}, earlyOpen=false, lateOpen=false;

  function renderCalendar(){
    var monthLabel     = $('monthLabel');
    var weekdaysEl     = $('weekdays');
    var grid           = $('grid');

    if (!grid) return;
    var monthName=monthFmt.format(new Date(state.year,state.month,1));
    if (monthLabel)  monthLabel.textContent = (monthName.charAt(0).toUpperCase()+monthName.slice(1))+' '+state.year;

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
      cell.addEventListener('dragover', function(e){
  try {
    var types = e.dataTransfer && e.dataTransfer.types;
    var hasMove = false, hasResize = false;
    if (types) {
      var arr = (typeof types.contains==='function') ? {contains:function(t){return types.contains(t);} } : {contains:function(t){ return Array.prototype.indexOf.call(types,t)!==-1; }};
      hasMove = arr.contains('text/calendar-event');
      hasResize = arr.contains('text/calendar-resize-end');
    }
    if (hasMove || hasResize) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // don't block other handlers on dragover; only stop on drop for resize
      cell.classList.add('drop-target');
    }
  } catch(_){}
});
          cell.addEventListener('dragleave',function(){ this.classList.remove('drop-target'); });
      cell.addEventListener('drop',function(e){
        e.preventDefault(); this.classList.remove('drop-target');
        try{
          var payload=e.dataTransfer.getData('text/calendar-event'); if(!payload) return;
          var obj=JSON.parse(payload); var fromDate=obj.fromDate; var id=obj.id; var toDate=this.dataset.date; if(!fromDate||!id||toDate===fromDate) return;
          var fromArr=Data.getEventsFor(fromDate); var idx=Ev.findIndexById(fromArr,id); if(idx===-1) return;
          var moved=fromArr.splice(idx,1)[0]; Data.setEventsFor(fromDate,fromArr);
          renderAllCells(); var toArr=Data.getEventsFor(toDate); toArr.push(moved); Data.setEventsFor(toDate,toArr);
          withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} }); withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} }); var cFrom=cells.find(function(c){return c.dataset.date===fromDate;}); if(cFrom) renderCell(cFrom);
          renderCell(this); renderTodayPanel();
        renderAllCells(); }catch(err){ console.warn('drop failed',err); }
      });

      grid.appendChild(cell); cells.push(cell);
    }
    withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} });
  }

  function renderAllCells(){ for(var i=0;i<cells.length;i++){ renderCell(cells[i]); } if (typeof enableResizeDnDOnCells==='function'){ enableResizeDnDOnCells(); } }

  // Enable resizing multi-day end via DnD payload 'text/calendar-resize-end'
  function enableResizeDnDOnCells(){
    for (var i=0;i<cells.length;i++){
      (function(cell){
        if (!cell.__resizeEnabled){
          cell.addEventListener('dragover', function(e){
            try {
              if (e.dataTransfer && (e.dataTransfer.types||[]).indexOf('text/calendar-resize-end')!==-1){
                e.preventDefault(); e.dataTransfer.dropEffect='move'; e.stopImmediatePropagation(); cell.classList.add('drop-target');
              }
            } catch(_){}
          });
          cell.addEventListener('dragleave', function(){ cell.classList.remove('drop-target'); });
          cell.addEventListener('drop', function(e){
            cell.classList.remove('drop-target');
            try{
              var payload = e.dataTransfer.getData('text/calendar-resize-end');
              if (!payload) return;
              e.preventDefault();
              e.stopImmediatePropagation(); var obj = JSON.parse(payload||'{}');
              var startDate = obj.startDate, id = obj.id;
              var toDate = cell.dataset.date;
              if (!startDate || !id || !toDate) return;
              var arr = Data.getEventsFor(startDate);
              var idx = Ev.findIndexById(arr, id);
              if (idx===-1) return;
              // set end_date = null if toDate == startDate, else toDate
              arr[idx].end_date = (toDate===startDate) ? null : toDate;
              Data.setEventsFor(startDate, arr);
              renderAllCells(); // re-render affected range (old/new)
              renderAllCells();
              renderTodayPanel();
            }catch(err){ console.warn('resize drop failed', err); }
          });
          cell.__resizeEnabled = true;
        }
      })(cells[i]);
    }
  }
  enableResizeDnDOnCells();

  function findCell(dateISO){ for(var i=0;i<cells.length;i++){ if(cells[i].dataset.date===dateISO) return cells[i]; } return null; }

  
// === Multi-day helpers ===
function ymd(d){ return (d instanceof Date ? d.toISOString().slice(0,10) : (d||'')).slice(0,10); }
function parseYMD(s){ var a=(s||'').split('-').map(Number); return new Date(a[0], (a[1]||1)-1, a[2]||1); }
function addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
function segmentForDay(day, startDay, endDay){
  var d=ymd(day), a=ymd(startDay), b=ymd(endDay||startDay);
  if (b<a){ var t=a; a=b; b=t; }
  if (d<a || d>b) return null;
  if (a===b) return 'single';
  if (d===a) return 'start';
  if (d===b) return 'end';
  return 'mid';
}
function getEventsForDayExpanded(dateISO){
  var base = (Data.getEventsFor ? Data.getEventsFor(dateISO) : []).slice();
  var out = base.map(function(ev){ var c=Object.assign({}, ev); c._seg = ev.end_date ? segmentForDay(dateISO, dateISO, ev.end_date) : 'single'; c._startDay=dateISO; return c; });
  if (typeof Data._getCache === 'function'){
    var cache = Data._getCache() || {};
    Object.keys(cache).forEach(function(day){
      if (day===dateISO) return;
      var arr = cache[day] || [];
      for (var i=0;i<arr.length;i++){
        var ev = arr[i]; if (!ev || !ev.end_date) continue;
        var seg = segmentForDay(dateISO, day, ev.end_date);
        if (!seg) continue;
        var c = Object.assign({}, ev); c._seg = seg; c._startDay = day;
        out.push(c);
      }
    });
  }
  // sort: time asc (numeric), then urgent desc, then title
  out.sort(function(a,b){
    function toM(t){ var p=String(t||'00:00').split(':'); var h=+p[0]||0, m=+p[1]||0; return h*60+m; }
    var am=toM(a.time), bm=toM(b.time);
    if (am!==bm) return am-bm;
    var u=(b.urgent|0)-(a.urgent|0); if (u) return u;
    return (a.title||'').localeCompare(b.title||'');
  });
return out;
}

function renderCell(cell){
    var dateISO=cell.dataset.date; var list=cell.querySelector('.events'); list.innerHTML='';
    var events=getEventsForDayExpanded(dateISO);
    
    var matcher=Ev.buildMatcher(currentType, filterText ? filterText.value : '');
    var filtered=events.filter(matcher);

    for(var i=0;i<filtered.length;i++){
      var ev=filtered[i];
      var item=document.createElement('div'); item.className='event '+Ev.typeToClass(ev.type)+(ev.urgent?' urgent':''); if (ev && ev.done) { try { item.classList.add('done'); } catch(_){ item.className += ' done'; } } item.setAttribute('draggable', (ev._seg && ev._seg==='mid') ? 'false' : 'true'); item.setAttribute('data-id',ev.id);
item.setAttribute('data-seg', (ev._seg||'single'));
      item.setAttribute('data-start', (ev._startDay||dateISO));
    item.addEventListener('dragstart',function(e){
  var d=e.currentTarget;
  var dt=e.dataTransfer; if (!dt) return;
  d.classList.add('dragging'); dt.effectAllowed='move';
  var seg=d.getAttribute('data-seg');
  var sday=d.getAttribute('data-start')||dateISO;
  var eid = d.getAttribute('data-id');
  if (seg==='end'){
    dt.setData('text/calendar-resize-end', JSON.stringify({ startDate: sday, id: eid }));
  } else {
    // standard move from start/single
    dt.setData('text/calendar-event', JSON.stringify({ fromDate: sday, id: eid }));
  }
});
item.addEventListener('dragend',function(e){ e.currentTarget.classList.remove('dragging'); });

      var bar=document.createElement('div'); bar.className='bar';
    
    // -- compact content for multi-day segments: no extra badges/owner lines --
    var __isMultiSeg = !!(ev._seg && ev._seg!=='single');

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
        var arr=Data.getEventsFor(dateISO); var idx=Ev.findIndexById(arr,eid); if(idx>-1){ arr.splice(idx,1); Data.setEventsFor(dateISO,arr); withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} }); renderCell(cell); renderTodayPanel(); renderAllCells(); renderAllCells();
    }
      });
      
      item.addEventListener('click',function(e){ e.stopPropagation(); var eid=this.getAttribute('data-id'); var seg=this.getAttribute('data-seg'); var sday=this.getAttribute('data-start')||dateISO; if(seg&&seg!=='single'){ openModalEdit(sday, eid); } else { openInfo(dateISO,eid); } });

      item.appendChild(bar);
      item.appendChild(time);
      item.appendChild(title);
      
    
    if (ev._seg && ev._seg!=='single'){ item.classList.add('ev--multi'); }
if (ev._seg){ item.className += ' ev--'+ev._seg; }      // item.appendChild(del);
      if (!__isMultiSeg){ item.appendChild(owner); }
      item.setAttribute('title', ev.title||'');
      list.appendChild(item);
    }
  }
/* ===== Таймлайн «Сьогодні» ===== */
;(function(){ try{
  var btnEarly      = $('btnEarly');
  var btnLate       = $('btnLate');

  if (typeof btnEarly!=='undefined' && btnEarly) btnEarly.addEventListener('click',function(){ earlyOpen=!earlyOpen; renderTodayPanel(); });
  if (typeof btnLate!=='undefined' && btnLate)  btnLate.addEventListener('click',function(){ lateOpen=!lateOpen; renderTodayPanel(); });
} catch(_){ /* no-op */ } })();

  function renderTodayPanel(){
    var earlyTimeline = $('earlyTimeline');
    var todayTimeline = $('todayTimeline');
    var lateTimeline  = $('lateTimeline');

    if (!todayTimeline) return;
    try {
      earlyTimeline.innerHTML = '';
      todayTimeline.innerHTML = '';
      lateTimeline.innerHTML  = '';
    } catch (_) { return; }

    hourHoverCount = {}; quarterHas = {};

    var todayISO = Ev.toISODate(today);
    var nextISO  = Ev.toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate()+1));

    var matcher  = Ev.buildMatcher(currentType, filterText ? filterText.value : '');
    var allToday = getEventsForDayExpanded(todayISO)
      .filter(matcher)
      .sort(function(a,b){ function toM(t){ var p=String(t||'00:00').split(':'); var h=+p[0]||0, m=+p[1]||0; return h*60+m; } var am=toM(a.time), bm=toM(b.time); if (am!==bm) return am-bm; var u=(b.urgent|0)-(a.urgent|0); if (u) return u; return (a.title||'').localeCompare(b.title||''); });
    var allNext  = getEventsForDayExpanded(nextISO)
      .filter(matcher)
      .sort(function(a,b){ function toM(t){ var p=String(t||'00:00').split(':'); var h=+p[0]||0, m=+p[1]||0; return h*60+m; } var am=toM(a.time), bm=toM(b.time); if (am!==bm) return am-bm; var u=(b.urgent|0)-(a.urgent|0); if (u) return u; return (a.title||'').localeCompare(b.title||''); });

    quarterHas[todayISO] = {}; quarterHas[nextISO] = {};

    for (var i1=0; i1<allToday.length; i1++) {
      var p = (allToday[i1].time||'00:00').split(':'), hh = +p[0]||0, mm = +p[1]||0;
      if (mm!==0) quarterHas[todayISO][hh] = true;
    }
    for (var j1=0; j1<allNext.length; j1++) {
      var q = (allNext[j1].time||'00:00').split(':'), h2 = +q[0]||0, m2 = +q[1]||0;
      if (m2!==0) quarterHas[nextISO][h2] = true;
    }

    var earlyCount = allToday.filter(function(e){ var h=(+((e.time||'00:00').split(':')[0])||0); return h<6; }).length;
    var lateCount  = allNext .filter(function(e){ var h=(+((e.time||'00:00').split(':')[0])||0); return h<6; }).length;
    var earlyCountEl = $('earlyCount'), lateCountEl = $('lateCount');
    if (earlyCountEl) earlyCountEl.textContent = earlyCount ? ('подій: '+earlyCount) : '';
    if (lateCountEl)  lateCountEl.textContent  = lateCount  ? ('подій: '+lateCount)  : '';

    var earlyWrap     = $('earlyWrap');
    var lateWrap      = $('lateWrap');
    if (earlyWrap) earlyWrap.classList.toggle('open', !!earlyOpen);
    if (lateWrap)  lateWrap.classList.toggle('open',  !!lateOpen);

    function buildByQuarter(list){
      var map = {};
      for (var h=0; h<24; h++){
        for (var m=0; m<60; m+=15){
          map[Ev.pad2(h)+':'+Ev.pad2(m)] = [];
        }
      }
      for (var k=0; k<list.length; k++){
        var ev = list[k];
        var parts = (ev.time||'00:00').split(':'), H = +parts[0]||0, M = +parts[1]||0;
        var key = Ev.pad2(H)+':'+Ev.pad2(Math.floor(M/15)*15);
        map[key].push(ev);
      }
      return map;
    }

    var byQToday = buildByQuarter(allToday);
    var byQNext  = buildByQuarter(allNext);

    

    // Restore interactive hour expand/collapse during DnD for Today panel
    function expandHour(dateISO, hour){
      ['15','30','45'].forEach(function(min){
        var elq = document.querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+hour+'"][data-min="'+min+'"]');
        if (elq) elq.style.display = 'grid';
      });
    }
    function collapseHour(dateISO, hour){
      // keep open if the hour has quarter events
      if (quarterHas[dateISO] && quarterHas[dateISO][hour]) return;
      ['15','30','45'].forEach(function(min){
        var elq = document.querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+hour+'"][data-min="'+min+'"]');
        if (elq) elq.style.display = 'none';
      });
    }
    
function renderGroup(tl, dateISO, startHour, endHour){
      if (!tl) return;
      for (var h=startHour; h<endHour; h++){
        for (var m=0; m<60; m+=15){
          var slot = document.createElement('div');
          slot.className = 'slot quarter';
          slot.dataset.date = dateISO;
          slot.dataset.hour = String(h);
          slot.dataset.min  = String(m);

          slot.addEventListener('dragenter', function(e){
            e.preventDefault(); this.classList.add('drop-target');
            var HH = parseInt(this.dataset.hour,10)||0; var key=this.dataset.date+'|'+HH;
            hourHoverCount[key] = (hourHoverCount[key]||0) + 1; if (this.dataset.min === '0') { expandHour(this.dataset.date, HH); }
          });
          slot.addEventListener('dragover', function(e){
            e.preventDefault(); this.classList.add('drop-target'); if (e.dataTransfer) e.dataTransfer.dropEffect='move';
          });
          slot.addEventListener('dragleave', function(){
            this.classList.remove('drop-target');
            var HH = parseInt(this.dataset.hour,10)||0; var key=this.dataset.date+'|'+HH;
            hourHoverCount[key] = Math.max((hourHoverCount[key]||1)-1,0); var date = this.dataset.date; setTimeout(function(){ if (hourHoverCount[key]===0 && !(quarterHas[date] && quarterHas[date][HH])) { collapseHour(date, HH); } }, 60);
          });
          slot.addEventListener('drop', function(e){
            e.preventDefault(); this.classList.remove('drop-target'); var HH = parseInt(this.dataset.hour,10)||0; var key=this.dataset.date+'|'+HH; hourHoverCount[key] = Math.max((hourHoverCount[key]||1)-1,0); var __date = this.dataset.date; setTimeout(function(){ if (hourHoverCount[key]===0 && !(quarterHas[__date] && quarterHas[__date][HH])) { collapseHour(__date, HH); } }, 60);
            try{
              var payload=e.dataTransfer && e.dataTransfer.getData('text/calendar-event'); if(!payload) return;
              var obj=JSON.parse(payload); var fromDate=obj.fromDate; var id=obj.id;
              var nh=parseInt(this.dataset.hour,10)||0; var nm=parseInt(this.dataset.min,10)||0; var newTime=Ev.pad2(nh)+':'+Ev.pad2(nm);
              var targetDate=this.dataset.date;
              if(fromDate && fromDate!==targetDate){
                var fromArr=Data.getEventsFor(fromDate); var idx=Ev.findIndexById(fromArr,id); if(idx===-1) return;
                var moved=fromArr.splice(idx,1)[0]; moved.time=newTime; Data.setEventsFor(fromDate,fromArr);
                renderAllCells(); var toArr=Data.getEventsFor(targetDate); toArr.push(moved); Data.setEventsFor(targetDate,toArr);
                withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} });
                var cFrom=findCell(fromDate); if(cFrom) renderCell(cFrom);
              } else {
                var arr=Data.getEventsFor(targetDate);
                arr = global.CalendarApp.events.updateEventTimeInArray(arr, id, newTime);
                Data.setEventsFor(targetDate, arr);
                renderAllCells();
              }
              var c1=findCell(targetDate); if(c1) renderCell(c1);
              renderTodayPanel();
            }catch(err){ console.warn('drop quarter',err); }
          });

          var time = document.createElement('div'); time.className='time'; time.textContent=(m===0?(Ev.pad2(h)+':00'):(':'+Ev.pad2(m))); if(m!==0) time.classList.add('qmin');
          var items= document.createElement('div'); items.className='items';

          var key = Ev.pad2(h)+':'+Ev.pad2(m);
          var arr = (dateISO===todayISO ? byQToday[key] : byQNext[key]) || [];
          for (var r=0; r<arr.length; r++){
            var ev = arr[r];
            var row = document.createElement('div');
            row.className = 'item' + (ev.urgent ? ' urgent' : '') + (ev && ev.done ? ' done' : '');
            var seg  = (ev && ev._seg) ? ev._seg : 'single';
            var sday = (ev && ev._startDay) ? ev._startDay : dateISO;
            row.dataset.date  = sday;
            row.dataset.id    = ev.id;
            row.dataset.start = sday;
            row.dataset.seg   = seg;
            row.setAttribute('draggable','true');
            if (seg !== 'single') row.classList.add('ev--multi');
            row.classList.add('ev--' + seg);
            row.addEventListener('dragstart', function(e){
              var id=e.currentTarget.dataset.id; var d=e.currentTarget.dataset.date;
              if (e.dataTransfer){ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/calendar-event', JSON.stringify({fromDate:d,id:id})); }
            });
            if (ev.urgent){
              var flag = document.createElement('span'); flag.className='flag-urgent';
              var icon = document.createElement('span'); icon.className='icon'; icon.innerHTML = '<svg class="icon"><use href="#i-fire-clock"></use></svg>';
              flag.appendChild(icon); row.appendChild(flag);
            }
            var dot = document.createElement('span'); dot.className = 'dot '+(ev.type||'evt'); row.appendChild(dot);
            var label = (ev.time||'')+' — '+ev.title+(ev.owner?(' • '+ev.owner):'');
            row.appendChild(document.createTextNode(label));
            row.addEventListener('click', function(){
              // В Today-панелі відкриваємо Info
              var did = this.dataset.id; var sday = this.dataset.start || this.dataset.date || dateISO; openInfo(sday, did);
            });
            items.appendChild(row);
          }

          if (m!==0){
            var keep = quarterHas[dateISO] && quarterHas[dateISO][h];
            slot.style.display = keep ? 'grid' : 'none';
          }
          slot.appendChild(time);
          slot.appendChild(items);
          tl.appendChild(slot);
        }
      }
    }

    if (earlyOpen) renderGroup(earlyTimeline, todayISO, 0, 6);
    renderGroup(todayTimeline, todayISO, 6, 24);
    if (lateOpen)  renderGroup(lateTimeline,  nextISO,  0, 6);
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
      withStableScroll(function(){ renderAllCells(); try{ renderTodayPanel(); }catch(_){} });
    });
  }

  // Експорт UI API (якщо буде потрібно з інших скриптів)
  global.CalendarApp = global.CalendarApp || {};
  global.CalendarApp.ui = global.CalendarApp.ui || {};
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