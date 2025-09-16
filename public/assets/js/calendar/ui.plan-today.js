// (function(global){
//   "use strict";

//   var Data = (global.CalendarApp && global.CalendarApp.data) || {};
//   var MOUNT_ID = "planning-today";

//   function parseDayKey(dk){
//     var p = String(dk||"").split("-").map(function(x){ return parseInt(x,10)||0; });
//     return new Date(p[0]||1970, (p[1]||1)-1, p[2]||1, 0, 0, 0, 0);
//   }

//   // Safe time parsing: supports "HH:MM" and ignores ISO date prefixes
//   function parseHoursMinutes(s){
//     var str = String(s||"");
//     var m = str.match(/(\d{1,2}):(\d{2})/);
//     var h = m ? parseInt(m[1],10) : 0;
//     var min = m ? parseInt(m[2],10) : 0;
//     if (!isFinite(h)) h = 0;
//     if (!isFinite(min)) min = 0;
//     return [h, min];
//   }

//   function toDate(dk, timeStr){
//     var d = parseDayKey(dk);
//     var hm = parseHoursMinutes(timeStr);
//     d.setHours(hm[0], hm[1], 0, 0);
//     return d;
//   }

//   function keyFromDateLocal(d){
//     var y = d.getFullYear();
//     var m = String(d.getMonth()+1).padStart(2,"0");
//     var day = String(d.getDate()).padStart(2,"0");
//     return y+"-"+m+"-"+day;
//   }

//   function formatTime(d){
//     var h = String(d.getHours()).padStart(2,"0");
//     var m = String(d.getMinutes()).padStart(2,"0");
//     return h+":"+m;
//   }

//   function ensureStore(cb){
//     try{
//       var store = (typeof Data._getCache === "function") ? Data._getCache() : (Data.dayMap || null);
//       if (store && typeof store === "object" && Object.keys(store).length){
//         cb(store);
//         return;
//       }
//       if (Data && typeof Data.serverLoadStore === "function"){
//         Data.serverLoadStore().then(function(resp){
//           var shaped = (typeof Data.ensureStoreShape === "function") ? Data.ensureStoreShape(resp) : (resp||{});
//           if (typeof Data._setCache === "function") Data._setCache(shaped);
//           cb(shaped||{});
//         }).catch(function(){
//           cb({});
//         });
//         return;
//       }
//     }catch(e){}
//     cb({});
//   }

//   function collectForDay(store, dk){
//     var arr = (store[dk]||[]), out = [];
//     for (var i=0;i<arr.length;i++){
//       var ev = arr[i] || {};
//       var start = toDate(dk, ev.time || ev.start || "00:00");
//       out.push({ start:start, ev:ev, dk:dk });
//     }
//     out.sort(function(a,b){ return a.start - b.start; });
//     return out;
//   }

//   // Section builder with grey date span
// function section(label, dateValue, items){
//   var wrap = document.createElement("div");
//   wrap.className = "planning-section";

//   var h = document.createElement("div");
//   h.className = "planning-section__title";

//   var labelEl = document.createElement("span");
//   labelEl.textContent = label + " ";

//   var dateEl = document.createElement("span");
//   dateEl.className = "planning-section__date";
//   dateEl.textContent = toUADisplayDate(dateValue);

//   h.appendChild(labelEl);
//   h.appendChild(dateEl);
//   wrap.appendChild(h);

//   if (!items.length){
//     var empty = document.createElement("div");
//     empty.className = "planning-empty";
//     empty.textContent = "Список пуст";
//     wrap.appendChild(empty);
//     return wrap;
//   }

//   var ul = document.createElement("ul");
//   ul.className = "planning-today__list";

//   for (var i=0;i<items.length;i++){
//     var it = items[i];
//     var li = document.createElement("li");
//     li.className = "planning-today__item";
//     if (it.ev.urgent) li.classList.add("urgent");
//     if (it.ev.done) li.classList.add("done");

//     var time = document.createElement("div");
//     time.className = "planning-today__time";
//     time.textContent = formatTime(it.start);

//     var details = document.createElement("div");
//     details.className = "planning-today__details";

//     var titleEl = document.createElement("div");
//     titleEl.className = "planning-today__title";
//     titleEl.textContent = it.ev.title || "";

//     var owner = document.createElement("div");
//     owner.className = "planning-today__owner";
//     owner.textContent = it.ev.owner ? String(it.ev.owner) : "";

//     details.appendChild(titleEl);
//     if (owner.textContent) details.appendChild(owner);

//     li.appendChild(time);
//     li.appendChild(details);
//     ul.appendChild(li);
//   }

//   wrap.appendChild(ul);
//   return wrap;
// }


//   function render(store){
//     var mount = document.getElementById(MOUNT_ID);
//     if (!mount) return;

//     var now = new Date();
//     var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

//     var dkY  = keyFromDateLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate()-1));
//     var dkT  = keyFromDateLocal(base);
//     var dkZ  = keyFromDateLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate()+1));
//     var dkPz = keyFromDateLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate()+2));

//     var sY  = collectForDay(store, dkY);
//     var sT  = collectForDay(store, dkT);
//     var sZ  = collectForDay(store, dkZ);
//     var sPz = collectForDay(store, dkPz);

//     // Date objects for headings
//     var dY  = parseDayKey(dkY);
//     var dT  = parseDayKey(dkT);
//     var dZ  = parseDayKey(dkZ);
//     var dPz = parseDayKey(dkPz);

//     var fmt = { dateStyle: 'long', timeZone: 'Europe/Kyiv' };

//     var frag = document.createDocumentFragment();
// frag.appendChild(section("Вчора",       dY,  sY));
// frag.appendChild(section("Сьогодні",    dT,  sT));
// frag.appendChild(section("Завтра",      dZ,  sZ));
// frag.appendChild(section("Післязавтра", dPz, sPz));

//     mount.innerHTML = "";
//     mount.appendChild(frag);
//   }

//   function init(){ ensureStore(function(store){ render(store||{}); }); }
//   if (document.readyState === "loading"){
//     document.addEventListener("DOMContentLoaded", init);
//   } else {
//     init();
//   }
// })(window);


// // --- Add once (helpers for UA date formatting) ---
// function formatDateUA(d){
//   var weekdays = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
//   var monthsGen = [
//     'січня','лютого','березня','квітня','травня','червня',
//     'липня','серпня','вересня','жовтня','листопада','грудня'
//   ];
//   var dow = weekdays[d.getDay()];
//   var dd  = String(d.getDate()).padStart(2,'0');
//   var mon = monthsGen[d.getMonth()];
//   var yyyy = d.getFullYear();
//   return dow + ', ' + dd + ' ' + mon + ' ' + yyyy;
// }

// function toUADisplayDate(dateLike){
//   if (dateLike instanceof Date && !isNaN(dateLike)) return formatDateUA(dateLike);
//   var d = new Date(dateLike);
//   return isNaN(d) ? String(dateLike || '') : formatDateUA(d);
// }


(function(global){
  "use strict";

  var Data = (global.CalendarApp && global.CalendarApp.data) || {};
  var MOUNT_ID = "planning-today";

  function parseDayKey(dk){
    var p = String(dk||"").split("-").map(function(x){ return parseInt(x,10)||0; });
    return new Date(p[0]||1970, (p[1]||1)-1, p[2]||1, 0, 0, 0, 0);
  }

  // Safe time parsing: supports "HH:MM" and ignores ISO date prefixes
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

  function ensureStore(cb){
    try{
      var store = (typeof Data._getCache === "function") ? Data._getCache() : (Data.dayMap || null);
      if (store && typeof store === "object" && Object.keys(store).length){
        cb(store);
        return;
      }
      if (Data && typeof Data.serverLoadStore === "function"){
        Data.serverLoadStore().then(function(resp){
          var shaped = (typeof Data.ensureStoreShape === "function") ? Data.ensureStoreShape(resp) : (resp||{});
          if (typeof Data._setCache === "function") Data._setCache(shaped);
          cb(shaped||{});
        }).catch(function(){
          cb({});
        });
        return;
      }
    }catch(e){}
    cb({});
  }

  function collectForDay(store, dk){
    var arr = (store[dk]||[]), out = [];
    for (var i=0;i<arr.length;i++){
      var ev = arr[i] || {};
      var start = toDate(dk, ev.time || ev.start || "00:00");
      out.push({ start:start, ev:ev, dk:dk });
    }
    out.sort(function(a,b){ return a.start - b.start; });
    return out;
  }

  // --- use existing global helpers for event type (NO override) ---
  var _typeToClass   = typeof global.typeToClass   === "function" ? global.typeToClass   : function(t){
    return t==='mi'?'type-mi':t==='nas'?'type-nas':t==='evt'?'type-evt':'type-other';
  };
  var _labelForType  = typeof global.labelForType  === "function" ? global.labelForType  : function(t){
    return t==='mi'?'ТЛГ: МИ':t==='nas'?'ТЛГ: НАС':t==='evt'?'Захід':'Інше';
  };
  // --- end type helpers ---

  // Section builder with grey date span
  function section(label, dateValue, items){
    var wrap = document.createElement("div");
    wrap.className = "planning-section";

    var h = document.createElement("div");
    h.className = "planning-section__title";

    var labelEl = document.createElement("span");
    labelEl.textContent = label + " ";

    var dateEl = document.createElement("span");
    dateEl.className = "planning-section__date";
    dateEl.textContent = toUADisplayDate(dateValue);

    h.appendChild(labelEl);
    h.appendChild(dateEl);
    wrap.appendChild(h);

    if (!items.length){
      var empty = document.createElement("div");
      empty.className = "planning-empty";
      empty.textContent = "Список пуст";
      wrap.appendChild(empty);
      return wrap;
    }

    var ul = document.createElement("ul");
    ul.className = "planning-today__list";

   for (var i=0;i<items.length;i++){
  var it = items[i];
  var li = document.createElement("li");
  li.className = "planning-today__item";
  if (it.ev.urgent) li.classList.add("urgent");
  if (it.ev.done) li.classList.add("done");

  var time = document.createElement("div");
  time.className = "planning-today__time";
  time.textContent = formatTime(it.start);

  var details = document.createElement("div");
  details.className = "planning-today__details";

  // chip FIRST (uses your global helpers)
  var tRaw = String(it.ev.type || "").toLowerCase();
  var chip = document.createElement("span");
  chip.className = "chip " + _typeToClass(tRaw);
  chip.textContent = _labelForType(tRaw);
  chip.title = "Тип: " + chip.textContent;

  // title NEXT
  var titleEl = document.createElement("div");
  titleEl.className = "planning-today__title";
  titleEl.textContent = it.ev.title || "";

  var owner = document.createElement("div");
  owner.className = "planning-today__owner";
  owner.textContent = it.ev.owner ? String(it.ev.owner) : "";

  // order: chip -> title (same row), owner (wraps if needed)
  details.appendChild(chip);
  details.appendChild(titleEl);
  if (owner.textContent) details.appendChild(owner);

  li.appendChild(time);
  li.appendChild(details);
  ul.appendChild(li);
}


    wrap.appendChild(ul);
    return wrap;
  }

  function render(store){
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) return;

    var now = new Date();
    var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    var dkY  = keyFromDateLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate()-1));
    var dkT  = keyFromDateLocal(base);
    var dkZ  = keyFromDateLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate()+1));
    var dkPz = keyFromDateLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate()+2));

    var sY  = collectForDay(store, dkY);
    var sT  = collectForDay(store, dkT);
    var sZ  = collectForDay(store, dkZ);
    var sPz = collectForDay(store, dkPz);

    // Date objects for headings
    var dY  = parseDayKey(dkY);
    var dT  = parseDayKey(dkT);
    var dZ  = parseDayKey(dkZ);
    var dPz = parseDayKey(dkPz);

    var frag = document.createDocumentFragment();
    frag.appendChild(section("Вчора",       dY,  sY));
    frag.appendChild(section("Сьогодні",    dT,  sT));
    frag.appendChild(section("Завтра",      dZ,  sZ));
    frag.appendChild(section("Післязавтра", dPz, sPz));

    mount.innerHTML = "";
    mount.appendChild(frag);
  }

  function init(){ ensureStore(function(store){ render(store||{}); }); }
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);


// --- Add once (helpers for UA date formatting) ---
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
