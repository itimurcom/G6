/* @version calendar-ui v2.3 */
(function () {
  'use strict';
  var THEME_KEY   = 'ui-theme';
  var SIDEBAR_KEY = 'sidebar-open';
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
  function readSidebar(){ return localStorage.getItem(SIDEBAR_KEY) === '1'; }
  function saveSidebar(open){ localStorage.setItem(SIDEBAR_KEY, open ? '1' : '0'); }
  function applySidebar(open){
    var sb = document.getElementById('sidebar');
    var bd = document.getElementById('sidebarBackdrop');
    if (sb) sb.classList.toggle('open', !!open);
    var push = !!open && !mqMobile.matches;
    document.body.classList.toggle('sidebar-open', push);
    if (bd) bd.classList.toggle('show', !!open && mqMobile.matches);
  }
  function toggleSidebar(){
    var next = !readSidebar();
    saveSidebar(next);
    applySidebar(next);
  }
  function ensureFAB(){
    if(!document.getElementById('themeToggle')){
      var t = document.createElement('button');
      t.id='themeToggle'; t.className='ui-fab theme'; t.type='button'; t.title='Тема';
      t.setAttribute('aria-label','Тема'); document.body.appendChild(t);
      t.innerHTML = (readTheme()==='dark') ? sunSvg() : moonSvg();
    }
  }
  function setActiveLink(){
    var links = document.querySelectorAll('#sidebar nav a, .sidebar nav a');
    var path  = (location.pathname.replace(/\/+$|$/, '') || '/');
    links.forEach(function(a){
      var href = a.getAttribute('href') || '';
      try{
        var p = (new URL(href, location.origin)).pathname.replace(/\/+$|$/, '') || '/';
        a.classList.toggle('active', p === path);
      }catch(_){}
    });
  }
  function init(){
    ensureFAB();
    applyTheme(readTheme());
    applySidebar(readSidebar());
    setActiveLink();
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', function(){
      var cur  = document.documentElement.getAttribute('data-theme') || 'light';
      var next = (cur === 'dark') ? 'light' : 'dark';
      saveTheme(next); applyTheme(next);
    });
    
var backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) backdrop.addEventListener('click', function(){ saveSidebar(false); applySidebar(false); });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && readSidebar()) { saveSidebar(false); applySidebar(false); }
    });
    var sideNav = document.querySelector('#sidebar nav');
    if (sideNav) {
      sideNav.addEventListener('click', function(ev){
        var a = ev.target.closest('a');
        if (!a) return;
        saveSidebar(false);
        applySidebar(false);
      });
    }
    mqMobile.addEventListener && mqMobile.addEventListener('change', function(){
      applySidebar(readSidebar());
    });
    console.debug('UI ready (v2.3)');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
