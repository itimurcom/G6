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
        var icon=document.createElement('span'); icon.className='icon'; icon.textContent='🔥';
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

  