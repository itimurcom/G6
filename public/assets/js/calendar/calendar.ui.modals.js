(function (global) {
  "use strict";

  var Data        = (global.CalendarApp && global.CalendarApp.data)   || {};
  var Ev          = (global.CalendarApp && global.CalendarApp.events) || {};
  var UI          = (global.CalendarApp && global.CalendarApp.ui)     || {};
  var renderAllFn = (UI && UI.renderAllFn) || function(){};

  var locale = 'uk-UA';
  var weekdayShortFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  // === Helpers ===
  function $id(id){ return document.getElementById(id); }

  // Multi-day helpers
  function __isoToUTCDate(iso){ var a=String(iso).split('-').map(Number); return new Date(Date.UTC(a[0], a[1]-1, a[2])); }
  function __addDaysUTC(d, n){ return new Date(d.getTime() + n*86400000); }
  function __fmtISO(d){ var y=d.getUTCFullYear(), m=String(d.getUTCMonth()+1).padStart(2,'0'), da=String(d.getUTCDate()).padStart(2,'0'); return y+'-'+m+'-'+da; }
  function __hasEventOn(dateISO, id){
    try {
      var arr = (typeof Data!=='undefined' && Data.getEventsFor) ? (Data.getEventsFor(dateISO)||[]) : [];
      for (var i=0;i<arr.length;i++){ var e=arr[i]; if (e && e.id===id) return true; }
    } catch(_){}
    return false;
  }
  function __findStartDateByScan(id, hintISO){
    var cur = __isoToUTCDate(hintISO);
    for (var i=0;i<120;i++){
      var prev = __addDaysUTC(cur, -1);
      var prevISO = __fmtISO(prev);
      if (!__hasEventOn(prevISO, id)) break;
      cur = prev;
    }
    return __fmtISO(cur);
  }
  function ukDayWord(n){
    n = Math.abs(n) % 100;
    var n1 = n % 10;
    if (n>10 && n<20) return 'днів';
    if (n1>1 && n1<5) return 'дні';
    if (n1==1) return 'день';
    return 'днів';
  }

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
        .catch(function(){});
    } catch(_){}
  })();

  function canEditEvent(ev){
    if (!ev) return false;
    var uid  = parseInt(ev.user_id || 0, 10) || 0;
    var meId = __me.id || getCurrentUserId() || 0;
    return (__me.isAdmin === true) || (uid > 0 && meId > 0 && uid === meId);
  }
  // === /permissions ===

  // Inputs
  var inputDate     = $id('inputDate');
  var inputTime     = $id('inputTime');
  var inputSpanDays = $id('inputSpanDays');
  var inputTitle    = $id('inputTitle');

  var inputOwner    = $id('inputOwner');
  var inputType     = $id('inputType');
  var inputUrgent   = $id('inputUrgent');
  var inputDone     = $id('inputDone');

  var inputIncoming     = $id('inputIncoming');
  var inputOutgoing     = $id('inputOutgoing');
  var inputDescription  = $id('inputDescription');

  // Info modal
  var infoOverlay = $id('infoOverlay');
  var infoModal   = infoOverlay ? infoOverlay.querySelector('.modal') : null;
  var infoClose   = $id('infoClose');
  var infoOk      = $id('infoOk');

  // Edit modal
  var overlay   = $id('eventOverlay');
  var modal     = $id('eventModal');
  var editModal = overlay ? overlay.querySelector('.modal') : null;
  var btnClose  = $id('btnClose');
  var btnCancel = $id('btnCancel');

  var __lastFocusEl = null;

  if (infoClose) infoClose.addEventListener('click', function(){ closeInfo(); });
  if (infoOk)    infoOk.addEventListener('click',    function(){ closeInfo(); });

  if (inputType)   inputType.addEventListener('change', function(){ setEditModalType(inputType.value); });
  if (inputUrgent) inputUrgent.addEventListener('change', applyUrgentClass);
  if (inputDone)   inputDone.addEventListener('change',   applyDoneClass);

  if (btnClose)  btnClose.addEventListener('click',  function(){ closeOverlay(); });
  if (btnCancel) btnCancel.addEventListener('click', function(){ closeOverlay(); });

  // Export UI API
  global.CalendarApp = global.CalendarApp || {};
  global.CalendarApp.ui = global.CalendarApp.ui || {};
  global.CalendarApp.ui.showSaving    = showSaving;
  global.CalendarApp.ui.hideSaving    = hideSaving;
  global.CalendarApp.ui.openModalNew  = openModalNew;
  global.CalendarApp.ui.openModalEdit = openModalEdit;
  global.CalendarApp.ui.openInfo      = openInfo;
  global.CalendarApp.ui.closeOverlay  = closeOverlay;
  global.CalendarApp.ui.closeInfo     = closeInfo;

  /* ===== Refresh glue (to keep My Tasks in sync) ===== */
  function forceRefreshUI(detail){
    // Dispatch a DOM event other modules can listen to
    try { document.dispatchEvent(new CustomEvent('calendar:changed', {detail: detail||{}})); } catch(_){}

    // Touch localStorage to trigger storage listeners
    try { localStorage.setItem('calendar:lastChange', String(Date.now())); } catch(_){}

    // Call known refreshers if present
    try {
      if (typeof global.refresh === 'function') global.refresh();
      if (UI) {
        if (typeof UI.renderAllFn === 'function') UI.renderAllFn();
        if (typeof UI.renderAll === 'function')   UI.renderAll();
        if (typeof UI.renderTasks === 'function') UI.renderTasks();
        if (typeof UI.refreshTasks === 'function') UI.refreshTasks();
      }
      if (global.CalendarApp && global.CalendarApp.data && typeof global.CalendarApp.data.reload === 'function'){
        global.CalendarApp.data.reload();
      }
    } catch(_){}
  }

  /* ===== UI helpers ===== */
  function setEditModalType(t){
    if (!editModal) return;
    editModal.classList.remove('type-mi','type-nas','type-evt','type-other');
    editModal.classList.add(t==='mi'?'type-mi':t==='nas'?'type-nas':t==='evt'?'type-evt':'type-other');
  }

  function ensureSaveToast(){
    var t = $id('saveToast');
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
        'transition:opacity .25s ease, transform .25s ease'
      ].join(';');
      var ico=document.createElement('span'); ico.id='saveToastIcon'; ico.textContent='⏳';
      var txt=document.createElement('span'); txt.id='saveToastText'; txt.textContent='Збереження…';
      t.appendChild(ico); t.appendChild(txt);
      document.body.appendChild(t);
    }
    return t;
  }

  function setToastMode(mode){
    var t=ensureSaveToast(); var ico=$id('saveToastIcon');
    t.style.borderColor = 'var(--border)';
    t.style.boxShadow   = '0 8px 20px rgba(0,0,0,.12)';
    t.style.color       = 'var(--fg)';
    t.style.background  = 'var(--event-bg)';
    if (mode==='saving'){
      ico.textContent='⏳';
    } else if (mode==='ok'){
      t.style.background='var(--type-evt)'; t.style.borderColor='var(--type-evt)'; t.style.color='#fff'; t.style.boxShadow='0 8px 24px rgba(34,197,94,.28)'; ico.textContent='✅';
      forceRefreshUI({source:'toast'});
    } else if (mode==='err'){
      t.style.background='var(--urgent)'; t.style.borderColor='var(--urgent)'; t.style.color='#fff'; t.style.boxShadow='0 8px 24px rgba(239,68,68,.28)'; ico.textContent='⚠️';
    }
  }
  function toastShow(){ var t=ensureSaveToast(); t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; }
  function toastHide(){ var t=ensureSaveToast(); t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(8px)'; }
  function showSaving(msg){ ensureSaveToast(); setToastMode('saving'); $id('saveToastText').textContent = msg || 'Збереження…'; toastShow(); }
  function hideSaving(ok){
    ensureSaveToast();
    if (ok===true){ setToastMode('ok'); $id('saveToastText').textContent='Збережено'; setTimeout(toastHide,950); }
    else if (ok===false){ setToastMode('err'); $id('saveToastText').textContent='Помилка збереження'; setTimeout(toastHide,1600); }
    else { toastHide(); }
  }

  function applyUrgentClass(){
    var urgentSwitch = $id('urgentSwitch');
    if (!editModal || !urgentSwitch || !inputUrgent) return;
    editModal.classList.toggle('urgent', !!inputUrgent.checked);
    urgentSwitch.classList.toggle('active', !!inputUrgent.checked);
  }

  function applyDoneClass(){
    var doneSwitch = $id('doneSwitch');
    if (!editModal || !doneSwitch || !inputDone) return;
    doneSwitch.classList.toggle('active', !!inputDone.checked);
  }

  function showOverlay(){
    if (!overlay) return;
    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden','false');
    overlay.classList.add('show');
    setTimeout(function(){ if(inputTitle) inputTitle.focus(); },0);
  }

  function closeOverlay(){
    if (!overlay) return;
    if (overlay.contains(document.activeElement)) { try{ document.activeElement.blur(); }catch(_){ } }
    var x = window.scrollX, y = window.scrollY;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden','true');
    overlay.setAttribute('inert','');
    requestAnimationFrame(function(){
      try{ window.scrollTo(x,y); }catch(_){}
      try{ __lastFocusEl && __lastFocusEl.focus && __lastFocusEl.focus({preventScroll:true}); }catch(_){}
    });
  }

  function openModalNew(dateISO){
    var modalTitle   = $id('modalTitle');
    var inputEndDate = $id('inputEndDate');

    try{ __lastFocusEl = document.activeElement; }catch(_){}
    if (!overlay) return;
    if (modalTitle) modalTitle.textContent='Нова подія';

    overlay.dataset.mode='new';
    overlay.dataset.origDate=dateISO;
    overlay.dataset.id='';
    overlay.dataset.startDate=dateISO; // keep start_date on client

    if (inputDate)   inputDate.value = dateISO;
    if (inputTime)   inputTime.value = Ev.defaultTime();

    if (inputEndDate)   inputEndDate.value = '';
    if (inputSpanDays)  inputSpanDays.value = '';
    if (inputTitle)     inputTitle.value = '';
    if (inputOwner)     inputOwner.value = '';
    if (inputType)      inputType.value = 'evt';
    if (inputUrgent)    inputUrgent.checked = false;
    if (inputDone)      inputDone.checked   = false;

    if (inputIncoming)     inputIncoming.value = '';
    if (inputOutgoing)     inputOutgoing.value = '';
    if (inputDescription)  inputDescription.value = '';

    setEditModalType(inputType ? inputType.value : 'evt');
    applyUrgentClass();
    applyDoneClass();
    showOverlay();
  }

  function openModalEdit(dateISO, id){
    var modalTitle = $id('modalTitle');
    try{ __lastFocusEl = document.activeElement; }catch(_){}
    if (!overlay) return;

    var arr = Data.getEventsFor(dateISO) || [];
    var ev  = arr.find(function(e){ return e.id===id; });
    if (!ev) return;

    if (typeof canEditEvent==='function' && !canEditEvent(ev)) { return; }

    if (inputSpanDays){
      var ed = ev.end_date || '';
      try{
        if (ed){
          var __a=dateISO.split('-').map(Number);
          var __b=ed.split('-').map(Number);
          var ds=new Date(Date.UTC(__a[0],__a[1]-1,__a[2]));
          var de=new Date(Date.UTC(__b[0],__b[1]-1,__b[2]));
          var diff = Math.round((de-ds)/86400000) + 1;
          inputSpanDays.value = (diff>0) ? String(diff) : '1';
        } else {
          inputSpanDays.value = '1';
        }
      } catch(_){ inputSpanDays.value = '1'; }
    }

    if (modalTitle) modalTitle.textContent='Редагувати подію';
    overlay.dataset.mode='edit';
    overlay.dataset.origDate=dateISO;
    overlay.dataset.id=id;
    overlay.dataset.startDate = ev.start_date || dateISO;

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

    setEditModalType(inputType ? inputType.value : 'evt');
    applyUrgentClass();
    applyDoneClass();
    showOverlay();
  }

  /* ===== Інфо ===== */
  function setInfoModalType(t){
    if (!infoModal) return;
    infoModal.classList.remove('type-mi','type-nas','type-evt','type-other');
    infoModal.classList.add(t==='mi'?'type-mi':t==='nas'?'type-nas':t==='evt'?'type-evt':'type-other');
  }

  function openInfo(dateISO,id){
    var infoContent = $id('infoContent');

    var arr = Data.getEventsFor(dateISO) || [];
    var ev  = arr.find(function(e){return e.id===id;});
    if(!ev) return;

    var p = dateISO.split('-').map(Number);
    var y = p[0], m = p[1], d = p[2];

    var __authorBlock = '';
    var __endBlock = '';

    try {
      var __uid = parseInt(ev.user_id||0,10) || 0;
      if (__uid > 0) {
        __authorBlock = '<div><strong>Автор:</strong> <span class="user--name" data-user-id="'+__uid+'"></span></div>';
      }
    } catch(_){}

    if (ev && ev.end_date){
      try {
        var startISO = ev.start_date || __findStartDateByScan(id, dateISO);
        var ds = __isoToUTCDate(startISO);
        var de = __isoToUTCDate(ev.end_date);
        if (de >= ds) {
          var days = Math.round((de - ds)/86400000) + 1;
          __endBlock = '<div><strong>Дата завершення:</strong> ' + Ev.formatISO(ev.end_date) + ' ('+ days + ' ' + ukDayWord(days) + ')</div>';
        } else {
          __endBlock = '<div><strong>Дата завершення:</strong> ' + Ev.formatISO(ev.end_date) + '</div>';
        }
      } catch(_){
        __endBlock = '<div><strong>Дата завершення:</strong> ' + Ev.formatISO(ev.end_date) + '</div>';
      }
    }

    var html = '' +
      '<div class="row">' +
        '<div><strong>Дата:</strong> '+Ev.formatISO(dateISO)+' ('+weekdayShortFmt.format(new Date(Date.UTC(y,m-1,d)))+')</div>' +
        __endBlock +
        '<div><strong>Час:</strong> '+(ev.time||'')+'</div>' +
      '</div>' +

      '<div class="row">' +
        '<div><strong>Тип:</strong> '+Ev.labelForType(ev.type)+'</div>' +
        '<div style="position:relative;margin-right:1em;">' +
          '<strong>Виконана:</strong> '+(ev.done?'так':'ні') +
          (ev.urgent ? '<span style="top:-36px;" class="flag-urgent"><span class="icon"><svg class="icon"><use href="#i-fire-clock"></use></svg></span></span>' : '') +
        '</div>' +
      '</div>' +
      '<div><strong>Назва:</strong> '+Ev.escapeHtml(ev.title||'')+'</div>' +
      '<div><strong>Відповідальний:</strong> '+Ev.escapeHtml(ev.owner||'—')+'</div>' +
      '<div><strong>Власник (створив):</strong> ' + (parseInt(ev.user_id||0,10) > 0 ? '<span class="user--name" data-user-id="'+parseInt(ev.user_id,10)+'"></span>' : '—') + '</div>' +
      __authorBlock +
      '<div><strong>Створено:</strong> ' + (ev.created_at ? Ev.escapeHtml(new Date(ev.created_at).toLocaleString(locale, {hour12:false})) : '—') + '</div>' +
      '<div><strong>Терміновість:</strong> '+(ev.urgent?'так':'ні')+'</div>' +
      (ev.incoming_no ? '<div><strong>Вхідний №:</strong> '+Ev.escapeHtml(ev.incoming_no||'—')+'</div>' : '') +
      (ev.outgoing_no ? '<div><strong>Вихідний №:</strong> '+Ev.escapeHtml(ev.outgoing_no||'—')+'</div>' : '') +
      (ev.description ? ('<div><strong>Опис:</strong><br><div class="container auto">'+Ev.escapeHtml(ev.description)+'</div></div>') : '');

    if (infoContent) infoContent.innerHTML = html;
    setInfoModalType(ev.type);

    if (infoOverlay){
      infoOverlay.classList.add('show');
      infoOverlay.setAttribute('aria-hidden','false');
      infoOverlay.removeAttribute('inert');

      var el = document.querySelector('#editEvBtn');
      if (el){
        el.setAttribute('data-id', id);
        var __can = (typeof canEditEvent==='function') ? canEditEvent(ev) : true;
        try { el.onclick = null; } catch(_){ }
        if (!__can) {
          el.hidden = true; el.setAttribute('aria-hidden','true'); el.tabIndex = -1;
        } else {
          el.hidden = false; el.removeAttribute('aria-hidden'); el.tabIndex = 0;
          el.onclick = function(e){
            closeInfo();
            e.stopPropagation();
            var eid = el.getAttribute('data-id');
            openModalEdit(el.getAttribute('data-start')||dateISO, eid);
          };
        }
      }
    }
  }

  function closeInfo(){
    if (!infoOverlay) return;
    if (infoOverlay.contains(document.activeElement)) { try{ document.activeElement.blur(); }catch(_){ } }
    infoOverlay.classList.remove('show');
    infoOverlay.setAttribute('aria-hidden','true');
    infoOverlay.setAttribute('inert','');
  }

  if (modal) modal.addEventListener('submit', function(e){
    e.preventDefault();

    try {
      if (modal && typeof modal.checkValidity === 'function' && !modal.checkValidity()) {
        if (typeof modal.reportValidity === 'function') modal.reportValidity();
        return;
      }
    } catch(_){}

    var newDate = inputDate ? inputDate.value : '';
    if (!newDate) return;

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
// FIX: Preserve or assign ev.user_id so "My tasks" updates immediately after save
(function ensureUserId(){
  try {
    if (typeof ev !== 'undefined' && ev && (ev.user_id === undefined || ev.user_id === null)) {
      var existing = null;
      var od = (typeof overlay !== 'undefined' && overlay && overlay.dataset && overlay.dataset.origDate)
        ? overlay.dataset.origDate
        : (typeof newDate !== 'undefined' ? newDate : null);

      if (od && typeof Data !== 'undefined' && Data && typeof Data.getEventsFor === 'function') {
        var arr0 = Data.getEventsFor(od) || [];
        for (var i = 0; i < arr0.length; i++) {
          var x = arr0[i];
          if (x && x.id === ev.id) { existing = x; break; }
        }
      }

      if (existing && existing.user_id != null) {
        ev.user_id = existing.user_id; // Editing: keep original author
      } else {
        // Creating or unknown: try to assign current user id from STATE or DOM
        var myId = 0;
        if (typeof STATE !== 'undefined' && STATE && STATE.userId) {
          var tmp = parseInt(STATE.userId, 10);
          if (!isNaN(tmp)) myId = tmp;
        }
        if (!myId) {
          var mt = (typeof document !== 'undefined') ? document.getElementById('planning-today') : null;
          if (mt && mt.dataset && mt.dataset.userId) {
            var tmp2 = parseInt(mt.dataset.userId, 10);
            if (!isNaN(tmp2)) myId = tmp2;
          }
        }
        if (myId) { ev.user_id = myId; }
      }
    }
  } catch (__e) {
    // swallow to avoid breaking save flow
  }
})();

    // keep start_date on client: set on create, preserve on edit
    var mode     = overlay ? overlay.dataset.mode : 'new';
    var origDate = overlay ? overlay.dataset.origDate : newDate;
    var startD   = overlay ? (overlay.dataset.startDate || '') : '';
    if (mode === 'new') { ev.start_date = newDate; } else { ev.start_date = startD || newDate; }

    if (!ev.title) return;
    if (!ev.type) ev.type = 'evt';

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
        var arrNew = Data.getEventsFor(newDate);
        arrNew.push(ev);
        Data.setEventsFor(newDate, arrNew);
      }

      // Strong refresh so "Мої задачі" та інші блоки синхронізуються
      if (typeof withStableScroll === 'function') { withStableScroll(renderAllFn); } else { try{ renderAllFn && renderAllFn(); }catch(_){}}
      forceRefreshUI({source:'submit', date:newDate, mode:mode, id:ev.id});

    } catch(err){
      console.warn('submit/save failed', err);
      return;
    }

    closeOverlay();
  });

})(window);