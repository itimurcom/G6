(function (global) {
  "use strict";

  var Data   = (global.CalendarApp && global.CalendarApp.data)   || {};
  var Ev     = (global.CalendarApp && global.CalendarApp.events) || {};
  var renderAllFn = global.CalendarApp.ui.renderAllFn;
  
  var locale='uk-UA';
  var weekdayShortFmt = new Intl.DateTimeFormat(locale,{weekday:'short'});

  // === Current user & permissions ===
  var __me = { id: 0, role: null, isAdmin: false };

  function getCurrentUserId(){
    var mt = document.getElementById('planning-today');
    var id = mt && mt.dataset ? parseInt(mt.dataset.userId || '0', 10) : 0;
    return isNaN(id) ? 0 : id;
  }

  (function preloadMe(){
    try { __me.id = getCurrentUserId(); } catch(_){ __me.id = 0; }
    try {
      fetch('/api/users/me')
        .then(function(r){ return r.json(); })
        .then(function(x){
          if (x && x.ok && x.user) {
            __me.role = x.user.role || null;
            __me.isAdmin = String(__me.role || '').toLowerCase() === 'admin';
          }
        })
        .catch(function(){ });
    } catch(_){}
  })();

  function canEditEvent(ev){
    if (!ev) return false;
    var uid  = parseInt(ev.user_id || 0, 10) || 0;
    var meId = __me.id || getCurrentUserId() || 0;
    return (__me.isAdmin === true) || (uid > 0 && meId > 0 && uid === meId);
  }
  // === /Current user & permissions ===

  var inputDate     = $('inputDate');
  var inputTime     = $('inputTime');
  var inputSpanDays = $('inputSpanDays');
  var inputTitle    = $('inputTitle');

  var inputOwner    = $('inputOwner');
  var inputType     = $('inputType');
  var inputUrgent   = $('inputUrgent');
  var inputDone     = $('inputDone');

  var inputIncoming     = $('inputIncoming');    // Вхідний номер // 8
  var inputOutgoing     = $('inputOutgoing');    // Вихідний номер // 8
  var inputDescription  = $('inputDescription'); // Опис (textarea) // 8

  // Інфо-модалка
  var infoOverlay   = $('infoOverlay'); // 13  
  var infoModal     = infoOverlay ? infoOverlay.querySelector('.modal') : null;
  var infoClose     = $('infoClose');
  var infoOk        = $('infoOk');

  // Модалка редагування
  var overlay      = $('eventOverlay'); // 29
  var modal        = $('eventModal'); // 19
  var editModal    = overlay ? overlay.querySelector('.modal') : null; // 7
  
  if (infoClose) infoClose.addEventListener('click',function(){ closeInfo(); });
  if (infoOk)    infoOk.addEventListener('click',function(){ closeInfo(); });

  if (inputType)   inputType.addEventListener('change',function(){ setEditModalType(inputType.value); });
  if (inputUrgent) inputUrgent.addEventListener('change',applyUrgentClass);
  if (inputDone)   inputDone.addEventListener('change',applyDoneClass);

  if (btnClose)  btnClose.addEventListener('click',function(){ closeOverlay(); });
  if (btnCancel) btnCancel.addEventListener('click',function(){ closeOverlay(); });
  
  // Експортуємо індикатор для data-модуля
  global.CalendarApp.ui.showSaving    = showSaving;
  global.CalendarApp.ui.hideSaving    = hideSaving;

  global.CalendarApp.ui.openModalNew  = openModalNew;
  global.CalendarApp.ui.openModalEdit = openModalEdit;
  global.CalendarApp.ui.openInfo      = openInfo; 

  global.CalendarApp.ui.closeOverlay  = closeOverlay;
  global.CalendarApp.ui.closeInfo     = closeInfo;


/* ===== Модалки ===== */
  function setEditModalType(t){
    if (!editModal) return;
    editModal.classList.remove('type-mi','type-nas','type-evt','type-other');
    editModal.classList.add(t==='mi'?'type-mi':t==='nas'?'type-nas':t==='evt'?'type-evt':'type-other');
  }

  // підсказки
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
    /* ===== Тост (індикатор) — внизу екрана ===== */
    var t=ensureSaveToast(); var ico=$('saveToastIcon');
    t.style.borderColor = 'var(--border)';
    t.style.boxShadow   = '0 8px 20px rgba(0,0,0,.12)';
    t.style.color       = 'var(--fg)';
    t.style.background  = 'var(--event-bg)';
    if (mode==='saving'){
      ico.textContent='⏳';
    } else if (mode==='ok'){
        if (typeof global.refresh == 'function') {
          global.refresh();
        }
        t.style.background='var(--type-evt)'; t.style.borderColor='var(--type-evt)'; t.style.color='#fff'; t.style.boxShadow='0 8px 24px rgba(34,197,94,.28)'; ico.textContent='✅';
      } else if (mode==='err'){
        t.style.background='var(--urgent)'; t.style.borderColor='var(--urgent)'; t.style.color='#fff'; t.style.boxShadow='0 8px 24px rgba(239,68,68,.28)'; ico.textContent='⚠️';
      }
  }

  function toastShow(){
    var t=ensureSaveToast();
    t.style.opacity='1';
    t.style.transform='translateX(-50%) translateY(0)';
  }

  function toastHide(){
    var t=ensureSaveToast();
    t.style.opacity='0';
    t.style.transform='translateX(-50%) translateY(8px)';
  }
  
  function showSaving(msg){
    ensureSaveToast();
    setToastAnchor();
    setToastMode('saving');
    $('saveToastText').textContent = msg || 'Збереження…'; toastShow();
  }
  
  function hideSaving(ok){
    ensureSaveToast();
    if (ok===true){ setToastMode('ok'); $('saveToastText').textContent='Збережено'; setTimeout(toastHide,950); }
    else if (ok===false){ setToastMode('err'); $('saveToastText').textContent='Помилка збереження'; setTimeout(toastHide,1600); }
    else { toastHide(); }
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

    // Guard permissions
    if (typeof canEditEvent==='function' && !canEditEvent(ev)) { try{ alert('Недостатньо прав для редагування цієї події'); }catch(_){ } return; }

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
              '<div><strong>Власник (створив):</strong> '+(parseInt(ev.user_id||0,10)>0?'<span class="user--name" data-user-id="'+parseInt(ev.user_id,10)+'"></span>':'—')+'</div>'+
              
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
      withStableScroll(renderAllFn);
    } catch(err){
      console.warn('submit/save failed', err);
      // If saving failed, keep modal open so user sees state
      return;
    }

    // Close the modal AFTER successful save/rerender
    closeOverlay();
  });
/* ===== Позначення подій як виконаних (close_user_id/close_time) ===== */
  
})(window);