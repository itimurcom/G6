/* ===== Ініціалізація ===== */
  function migrateEnsureIds(){
    var s = Data.readStore();
    var changed=false;
    for (var k in s){
      if(Object.prototype.hasOwnProperty.call(s,k)){
        var res = Ev.migrateArray(s[k]);
        s[k]=res.list; changed = changed || res.changed;
      }
    }
    if (changed) Data.writeStore(s);
  }

  function init(){
    // Рендер каркасу
    renderCalendar();
    // Завантаження й первинний рендер
    Data.serverLoadStore().then(function(data){
      Data._setCache( Data.ensureStoreShape(data) );
      migrateEnsureIds();
      renderAllCells(); renderTodayPanel();
    });
  }

  