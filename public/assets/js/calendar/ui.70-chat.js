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
          var icon=document.createElement('span'); icon.className='icon'; icon.textContent='🔥';
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

  