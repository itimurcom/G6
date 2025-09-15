// /assets/js/calendar/ui.loader.js
(function(){ "use strict";
  const version=(window.CALENDAR_BUILD_VERSION||Date.now())+"";
  const files=[
    "/assets/js/calendar/calendar.events.js",
    "/assets/js/calendar/calendar.data.js",
    "/assets/js/calendar/ui.00-preamble-and-refs.js",
    "/assets/js/calendar/ui.10-toast.js",
    "/assets/js/calendar/ui.20-filters.js",
    "/assets/js/calendar/ui.30-navigation.js",
    "/assets/js/calendar/ui.40-import-export.js",
    "/assets/js/calendar/ui.50-modals-edit.js",
    "/assets/js/calendar/ui.55-done.js",
    "/assets/js/calendar/ui.60-info-modal.js",
    "/assets/js/calendar/ui.70-chat.js",
    "/assets/js/calendar/ui.80-render-calendar.js",
    "/assets/js/calendar/ui.90-today-timeline.js",
    "/assets/js/calendar/ui.95-init.js",
    "/assets/js/calendar/ui.99-export-autostart.js"
  ];
  async function fetchText(url){
    const rsp=await fetch(url+(url.includes('?')?'':('?v='+version)));
    if(!rsp.ok) throw new Error('fetch '+url+' '+rsp.status);
    return await rsp.text();
  }
  (async function(){
    try{
      let bundle='';
      for(const f of files){
        const code=await fetchText(f);
        bundle+="\n\n/* ===== BEGIN "+f+" ===== */\n"+code+"\n/* ===== END "+f+" ===== */\n";
      }
      eval(bundle+"\n//# sourceURL=/calendar.bundle.js");
    }catch(err){
      console.error('[calendar/ui.loader] Failed:',err);
      if(window.alert && !window.__CAL_UI_LOADER_ALERTED__){
        window.__CAL_UI_LOADER_ALERTED__=true;
        alert('Calendar UI failed to load: '+err.message);
      }
    }
  })();
})();