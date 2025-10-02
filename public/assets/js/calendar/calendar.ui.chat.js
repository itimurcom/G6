/* calendar.ui.js — інтерфейс: DOM, рендер, модалки, таймлайн, чат, індикатор */
(function (global) {
    "use strict";

    // global для роботи
    var Ev     = (global.CalendarApp && global.CalendarApp.events) || {};
    var Data   = (global.CalendarApp && global.CalendarApp.data)   || {};
    var today=new Date();

    var btnChat     = $('btnChat');
    var chatOverlay = $('chatOverlay');
    var chatClose   = $('chatClose');
    var chatOk      = $('chatOk');
    var chatContent = $('chatContent');

/* ===== Чат (демо «ВКЗ») ===== */
  function openChat(){
    // Чат
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
  }
  if (btnChat)   btnChat.addEventListener('click',openChat);
  if (chatClose) chatClose.addEventListener('click', function(){ chatOverlay.classList.remove('show'); chatOverlay.setAttribute('aria-hidden','true'); chatOverlay.setAttribute('inert',''); });
  if (chatOk) chatOk.addEventListener('click', function(){ chatOverlay.classList.remove('show'); chatOverlay.setAttribute('aria-hidden','true'); chatOverlay.setAttribute('inert',''); });
})(window);