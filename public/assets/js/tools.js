// Safe time parsing: supports "HH:MM" and ignores ISO date prefixes
  // ---------- date/time helpers ----------
  function parseDayKey(dk){
    var p = String(dk||"").split("-").map(function(x){ return parseInt(x,10)||0; });
    return new Date(p[0]||1970, (p[1]||1)-1, p[2]||1, 0, 0, 0, 0);
  }  

function parseHoursMinutes(s){
    var str = String(s||"");
    var m = str.match(/(\d{1,2}):(\d{2})/);
    var h = m ? parseInt(m[1],10) : 0;
    var min = m ? parseInt(m[2],10) : 0;
    if (!isFinite(h)) h = 0;
    if (!isFinite(min)) min = 0;
    return [h, min];
  }

  function toDate(dk, timeStr){
    var d = parseDayKey(dk);
    var hm = parseHoursMinutes(timeStr);
    d.setHours(hm[0], hm[1], 0, 0);
    return d;
  }

  function keyFromDateLocal(d){
    var y = d.getFullYear();
    var m = String(d.getMonth()+1).padStart(2,"0");
    var day = String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+day;
  }

  function formatTime(d){
    var h = String(d.getHours()).padStart(2,"0");
    var m = String(d.getMinutes()).padStart(2,"0");
    return h+":"+m;
  }

  // ---------- UA date display helpers (single include) ----------
function formatDateUA(d){
  var weekdays = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
  var monthsGen = [
    'січня','лютого','березня','квітня','травня','червня',
    'липня','серпня','вересня','жовтня','листопада','грудня'
  ];
  var dow = weekdays[d.getDay()];
  var dd  = String(d.getDate()).padStart(2,'0');
  var mon = monthsGen[d.getMonth()];
  var yyyy = d.getFullYear();
  return dow + ', ' + dd + ' ' + mon + ' ' + yyyy;
}

function toUADisplayDate(dateLike){
  if (dateLike instanceof Date && !isNaN(dateLike)) return formatDateUA(dateLike);
  var d = new Date(dateLike);
  return isNaN(d) ? String(dateLike || '') : formatDateUA(d);
}
