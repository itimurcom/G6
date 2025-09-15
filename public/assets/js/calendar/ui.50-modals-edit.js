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
      user_id: 0
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

  