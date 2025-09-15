/* ===== Навігація місяців ===== */
  function changeMonth(delta){
    var m=state.month+delta, y=state.year;
    if(m<0){m+=12;y--;} if(m>11){m-=12;y++;}
    state.month=m; state.year=y; renderCalendar();
  }
  if (btnPrev)  btnPrev.addEventListener('click',function(){ changeMonth(-1); });
  if (btnNext)  btnNext.addEventListener('click',function(){ changeMonth(1); });
  if (btnToday) btnToday.addEventListener('click',function(){ state.year=today.getFullYear(); state.month=today.getMonth(); renderCalendar(); });
  window.addEventListener('keydown',function(e){
    if (['INPUT','SELECT','TEXTAREA'].includes(e.target && e.target.tagName)) return;
    if (e.key==='ArrowLeft') changeMonth(-1);
    if (e.key==='ArrowRight') changeMonth(1);
  });

  