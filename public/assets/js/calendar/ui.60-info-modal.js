/* ===== Інфо ===== */
  function setInfoModalType(t){
    if (!infoModal) return;
    infoModal.classList.remove('type-mi','type-nas','type-evt','type-other');
    infoModal.classList.add(t==='mi'?'type-mi':t==='nas'?'type-nas':t==='evt'?'type-evt':'type-other');
  }
  function openInfo(dateISO,id){
    var arr=Data.getEventsFor(dateISO); var ev=arr.find(function(e){return e.id===id;}); if(!ev) return;
    var html='<div><strong>Дата:</strong> '+Ev.formatISO(dateISO)+' ('+weekdayShortFmt.format(new Date(dateISO))+')</div>'+
             '<div><strong>Час:</strong> '+(ev.time||'')+'</div>'+
             '<div><strong>Назва:</strong> '+Ev.escapeHtml(ev.title||'')+(ev.urgent?' <span class="badge-urgent">🔥</span>':'')+'</div>'+
             '<div><strong>Відповідальний:</strong> '+Ev.escapeHtml(ev.owner||'—')+'</div>'+
             '<div><strong>Тип:</strong> '+Ev.labelForType(ev.type)+'</div>'+
             '<div><strong>Терміновість:</strong> '+(ev.urgent?'так':'ні')+'</div>' +
             '<div><strong>Виконана:</strong> '+(ev.done?'так':'ні')+'</div>';
    if (infoContent) infoContent.innerHTML=html;
      setInfoModalType(ev.type);
    if (infoOverlay){
      infoOverlay.classList.add('show'); infoOverlay.setAttribute('aria-hidden','false'); infoOverlay.removeAttribute('inert');
      document.body.style.overflow='hidden';
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

  