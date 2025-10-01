/* calendar.ui.toast.js — індикатор */
(function (global) {
  "use strict";
  
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

  // Експортуємо індикатор для data-модуля
  global.CalendarApp.ui.showSaving = showSaving;
  global.CalendarApp.ui.hideSaving = hideSaving;
})(window);