/* ===== Таймлайн «Сьогодні» ===== */
  if (btnEarly) btnEarly.addEventListener('click',function(){ earlyOpen=!earlyOpen; renderTodayPanel(); });
  if (btnLate)  btnLate.addEventListener('click',function(){ lateOpen=!lateOpen; renderTodayPanel(); });

  function renderTodayPanel(){
    if (!todayTimeline) return;
    earlyTimeline.innerHTML=''; todayTimeline.innerHTML=''; lateTimeline.innerHTML='';
    hourHoverCount={}; quarterHas={};

    var todayISO=Ev.toISODate(today);
    var nextISO =Ev.toISODate(new Date(today.getFullYear(),today.getMonth(),today.getDate()+1));

    var matcher=Ev.buildMatcher(currentType, filterText ? filterText.value : '');
    var allToday=Data.getEventsFor(todayISO).filter(matcher).sort(function(a,b){return (a.time||'').localeCompare(b.time||'');});
    var allNext =Data.getEventsFor(nextISO ).filter(matcher).sort(function(a,b){return (a.time||'').localeCompare(b.time||'');});

    quarterHas[todayISO]={}; quarterHas[nextISO]={};
    for(var i=0;i<allToday.length;i++){ var p=(allToday[i].time||'00:00').split(':'), hh=+p[0]||0, mm=+p[1]||0; if(mm!==0) quarterHas[todayISO][hh]=true; }
    for(var j=0;j<allNext.length;j++){ var q=(allNext[j].time||'00:00').split(':'), h2=+q[0]||0, m2=+q[1]||0; if(m2!==0) quarterHas[nextISO][h2]=true; }

    var earlyCount=allToday.filter(function(e){ var h=(+((e.time||'00:00').split(':')[0])||0); return h<6; }).length;
    var lateCount =allNext .filter(function(e){ var h=(+((e.time||'00:00').split(':')[0])||0); return h<6; }).length;
    var earlyCountEl=$('earlyCount'), lateCountEl=$('lateCount');
    if (earlyCountEl) earlyCountEl.textContent = earlyCount?('подій: '+earlyCount):'';
    if (lateCountEl)  lateCountEl.textContent  = lateCount ?('подій: '+lateCount) :'';
    if (earlyWrap) earlyWrap.classList.toggle('open',earlyOpen);
    if (lateWrap)  lateWrap.classList.toggle('open',lateOpen);

    function buildByQuarter(list){
      var map={}; for(var h=0;h<24;h++){ for(var m=0;m<60;m+=15){ map[Ev.pad2(h)+':'+Ev.pad2(m)]=[]; } }
      for(var k=0;k<list.length;k++){
        var ev=list[k]; var parts=(ev.time||'00:00').split(':'), H=+parts[0]||0, M=+parts[1]||0;
        var key=Ev.pad2(H)+':'+Ev.pad2(Math.floor(M/15)*15); map[key].push(ev);
      } return map;
    }
    var byQToday=buildByQuarter(allToday), byQNext=buildByQuarter(allNext);
    var tlAll={}; tlAll[todayISO]=earlyTimeline; tlAll[todayISO]=todayTimeline; tlAll[nextISO]=lateTimeline;

    function expandHour(dateISO,hour){
      ['15','30','45'].forEach(function(min){
        // var elq=(tlAll[dateISO]||document).querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+hour+'"][data-min="'+min+'"]');
        var elq=(document).querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+hour+'"][data-min="'+min+'"]');
        if(elq) elq.style.display='grid';
      });
    }
    function collapseHour(dateISO,hour){
      if(quarterHas[dateISO] && quarterHas[dateISO][hour]) return;
      ['15','30','45'].forEach(function(min){
        var elq=(tlAll[dateISO]||document).querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+hour+'"][data-min="'+min+'"]');
        if(elq) elq.style.display='none';
      });
    }
    window.foldAllQuarters=function(){
      Object.keys(tlAll).forEach(function(dateISO){
        for(var h=0;h<24;h++){
          var keep=quarterHas[dateISO] && quarterHas[dateISO][h];
          ['15','30','45'].forEach(function(min){
            var elq=tlAll[dateISO].querySelector('.slot.quarter[data-date="'+dateISO+'"][data-hour="'+h+'"][data-min="'+min+'"]');
            if(elq) elq.style.display = keep?'grid':'none';
          });
        }
      });
    };

    function renderGroup(tl,dateISO,startHour,endHour){
      if(!tl) return;
      for(var h=startHour; h<endHour; h++){
        for(var m=0; m<60; m+=15){
          var slot=document.createElement('div'); slot.className='slot quarter'; slot.dataset.date=dateISO; slot.dataset.hour=String(h); slot.dataset.min=String(m);

          slot.addEventListener('dragenter',function(e){
            e.preventDefault(); this.classList.add('drop-target');
            var HH=parseInt(this.dataset.hour,10)||0; var key=this.dataset.date+'|'+HH;
            hourHoverCount[key]=(hourHoverCount[key]||0)+1;
            if(this.dataset.min==='0'){ expandHour(this.dataset.date,HH); }
          });
          slot.addEventListener('dragover',function(e){ e.preventDefault(); this.classList.add('drop-target'); e.dataTransfer.dropEffect='move'; });
          slot.addEventListener('dragleave',function(){
            this.classList.remove('drop-target');
            var HH=parseInt(this.dataset.hour,10)||0; var key=this.dataset.date+'|'+HH;
            hourHoverCount[key]=Math.max((hourHoverCount[key]||1)-1,0);
            var date=this.dataset.date;
            setTimeout(function(){ if(hourHoverCount[key]===0 && !(quarterHas[date]&&quarterHas[date][HH])){ collapseHour(date,HH); } },60);
          });
          slot.addEventListener('drop',function(e){
            e.preventDefault(); this.classList.remove('drop-target');
            var HH=parseInt(this.dataset.hour,10)||0; var key=this.dataset.date+'|'+HH;
            hourHoverCount[key]=Math.max((hourHoverCount[key]||1)-1,0);
            try{
              var payload=e.dataTransfer.getData('text/calendar-event'); if(!payload) return;
              var obj=JSON.parse(payload); var fromDate=obj.fromDate; var id=obj.id;
              var nh=parseInt(this.dataset.hour,10)||0; var nm=parseInt(this.dataset.min,10)||0; var newTime=Ev.pad2(nh)+':'+Ev.pad2(nm);
              var targetDate=this.dataset.date;
              if(fromDate && fromDate!==targetDate){
                var fromArr=Data.getEventsFor(fromDate); var idx=Ev.findIndexById(fromArr,id); if(idx===-1) return;
                var moved=fromArr.splice(idx,1)[0]; moved.time=newTime; Data.setEventsFor(fromDate,fromArr);
                var toArr=Data.getEventsFor(targetDate); toArr.push(moved); Data.setEventsFor(targetDate,toArr);
                var cFrom=findCell(fromDate); if(cFrom) renderCell(cFrom);
              }else{
                var arr=Data.getEventsFor(targetDate);
                arr = global.CalendarApp.events.updateEventTimeInArray(arr, id, newTime);
                Data.setEventsFor(targetDate, arr);
              }
              var c1=findCell(targetDate); if(c1) renderCell(c1);
              renderTodayPanel();
            }catch(err){ console.warn('drop quarter',err); }
          });

          var time=document.createElement('div'); time.className='time'; time.textContent=(m===0?(Ev.pad2(h)+':00'):(':'+Ev.pad2(m))); if(m!==0) time.classList.add('qmin');
          var items=document.createElement('div'); items.className='items';

          var key=Ev.pad2(h)+':'+Ev.pad2(m);
          var arr=(dateISO===Ev.toISODate(today)? byQToday[key] : byQNext[key])||[];
          arr.forEach(function(ev){
            var row=document.createElement('div'); row.className='item'+(ev.urgent?' urgent':''); if (ev && ev.done) { try { row.classList.add('done'); } catch(_){ row.className += ' done'; } } row.dataset.date=dateISO; row.dataset.id=ev.id; row.setAttribute('draggable','true');
            row.addEventListener('dragstart',function(e){ var id=e.currentTarget.dataset.id; var d=e.currentTarget.dataset.date; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/calendar-event', JSON.stringify({fromDate:d,id:id})); });
            if(ev.urgent){ var flag=document.createElement('span'); flag.className='flag-urgent'; var icon=document.createElement('span'); icon.className='icon'; icon.textContent='🔥'; flag.appendChild(icon); row.appendChild(flag); }
            var dot=document.createElement('span'); dot.className='dot '+(ev.type||'evt'); row.appendChild(dot);
            var label=(ev.time||'')+' — '+ev.title+(ev.owner?(' • '+ev.owner):''); row.appendChild(document.createTextNode(label));
            row.addEventListener('click',function(){ openInfo(dateISO,ev.id); });
            items.appendChild(row);
          });

          if(m!==0){ var show=(quarterHas[dateISO]&&quarterHas[dateISO][h])?true:false; slot.style.display=show?'grid':'none'; }
          slot.appendChild(time); slot.appendChild(items); tl.appendChild(slot);
        }
      }
    }

    var byQToday=buildByQuarter(allToday);
    var byQNext =buildByQuarter(allNext);

    if(earlyOpen) renderGroup(earlyTimeline,todayISO,0,6);
    renderGroup(todayTimeline,todayISO,6,24);
    if(lateOpen)  renderGroup(lateTimeline,nextISO,0,6);
  }

  