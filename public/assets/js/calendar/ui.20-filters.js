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

  