/* @version calendar-ui v2.3 */
(function () {
  'use strict';
  var THEME_KEY   = 'ui-theme';
  var mqMobile    = window.matchMedia('(max-width: 900px)');

  function prefersDark(){ return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function readTheme(){ return localStorage.getItem(THEME_KEY) || (prefersDark() ? 'dark' : 'light'); }
  function saveTheme(t){ localStorage.setItem(THEME_KEY, t); }
  function sunSvg(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.36 6.36-1.42-1.42M8.05 8.05 6.63 6.63m10.73 0-1.42 1.42M8.05 15.95 6.63 17.37"/></svg>'; }
  function moonSvg(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'; }
  function updateThemeIcon(){
    var el = document.getElementById('themeToggle'); if(!el) return;
    var t  = document.documentElement.getAttribute('data-theme') || 'light';
    el.innerHTML = (t === 'dark') ? sunSvg() : moonSvg();
  }
  function applyTheme(t){
    document.documentElement.setAttribute('data-theme', (t === 'dark') ? 'dark' : 'light');
    updateThemeIcon();
  }

  function ensureFAB(){
    if(!document.getElementById('themeToggle')){
      var t = document.createElement('button');
      t.id='themeToggle'; t.className='ui-fab theme'; t.type='button'; t.title='Тема';
      t.setAttribute('aria-label','Тема'); document.body.appendChild(t);
      t.innerHTML = (readTheme()==='dark') ? sunSvg() : moonSvg();
    }
  }

  function app_init(){
    ensureFAB();
    applyTheme(readTheme());
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', function(){
      var cur  = document.documentElement.getAttribute('data-theme') || 'light';
      var next = (cur === 'dark') ? 'light' : 'dark';
      saveTheme(next); applyTheme(next);
    });
    
    console.debug('UI ready (v2.3)');
  }


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app_init);
  } else {
    app_init();
  }
})();


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

  // DOM посилання
  function $(id){ return document.getElementById(id); }
  function $id(id){ return document.getElementById(id); }

  function withStableScroll(fn){
    var x = window.scrollX, y = window.scrollY;
    try { fn && fn(); } catch(e){ console.warn('withStableScroll failed', e); }
    try { window.scrollTo(x, y); } catch(_){}
}