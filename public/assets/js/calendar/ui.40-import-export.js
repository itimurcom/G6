/* ===== Імпорт/Експорт ===== */
if (btnExport) btnExport.addEventListener('click', function(){
  Data.serverLoadStore().then(function(data){
    var blob = new Blob([JSON.stringify(data || {}, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'events.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  });
});

if (btnImport) btnImport.addEventListener('click', function(){
  if (filePicker) filePicker.click();
});

if (filePicker) filePicker.addEventListener('change', function(e){
  var f = e.target.files && e.target.files[0]; if (!f) return;
  f.text().then(function(text){
    try{
      var parsed = JSON.parse(text);
      Data._setCache( Data.ensureStoreShape(parsed) );
      return Data.serverSaveStore(Data._getCache()).then(function(){
        renderAllCells(); renderTodayPanel();
      });
    }catch(err){
      alert('Не вдалося імпортувати файл. Перевірте формат JSON.');
    }
  }).finally(function(){ filePicker.value=''; });
});
