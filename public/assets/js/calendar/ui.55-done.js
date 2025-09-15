/* ===== Позначення подій як виконаних (close_user_id/close_time) ===== */

// Ensure close fields exist on every event (in-place)
function migrateEnsureCloseFields(dayMap) {
  if (!dayMap || typeof dayMap !== 'object') return;
  Object.keys(dayMap).forEach(function (day) {
    var arr = dayMap[day];
    if (!Array.isArray(arr)) return;
    for (var i=0; i<arr.length; i++) {
      var ev = arr[i];
      if (!('close_user_id' in ev)) ev.close_user_id = null;
      if (!('close_time' in ev)) ev.close_time = null;
    }
  });
}

// Helper: is closed?
function isEventClosed(ev) {
  return !!(ev && ev.close_user_id && ev.close_time);
}

// Format closed label
function formatClosedAt(iso) {
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('uk-UA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

// Apply closed styling to an event DOM node (card/label)
// Expects: node is an element representing an event (div, a, etc.)
function applyClosedStyles(node, ev) {
  if (!node || !ev) return;
  if (isEventClosed(ev)) {
    node.classList.add('is-closed');
    // Append closed time text if there's a title container
    var title = node.querySelector('.event-title, .title, [data-role="event-title"]');
    if (title && !title.querySelector('.closed-note')) {
      var span = document.createElement('span');
      span.className = 'closed-note';
      span.style.marginLeft = '8px';
      span.textContent = '(закрито: ' + formatClosedAt(ev.close_time) + ')';
      title.appendChild(span);
    }
  } else {
    node.classList.remove('is-closed');
    var note = node.querySelector('.closed-note');
    if (note) note.remove();
  }
}

// Mark as done / reopen — in-memory + server
// You already have storeAll(dayMap) in backend API; here we'll call a small close endpoint for atomic updates.
function closeEventById(dayMap, eventId, userId) {
  if (!dayMap || !eventId) return Promise.reject(new Error('bad args'));
  var evRef = null, evDay = null, evIdx = -1;

  Object.keys(dayMap).some(function (d) {
    var idx = -1;
    var found = (dayMap[d] || []).some(function (e, i) {
      if (e.id === eventId) { idx = i; return true; }
      return false;
    });
    if (found) { evRef = dayMap[d][idx]; evDay = d; evIdx = idx; return true; }
    return false;
  });

  if (!evRef) return Promise.reject(new Error('not found'));

  var nowIso = new Date().toISOString();
  evRef.close_user_id = userId || 'system';
  evRef.close_time = nowIso;

  // optimistic UI — server sync
  return fetch('/api/events/close', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Accept':'application/json'},
    body: JSON.stringify({ id: eventId, close_user_id: evRef.close_user_id, close_time: evRef.close_time })
  }).then(function (r) {
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  });
}

function reopenEventById(dayMap, eventId) {
  if (!dayMap || !eventId) return Promise.reject(new Error('bad args'));
  var evRef = null;

  Object.keys(dayMap).some(function (d) {
    return (dayMap[d] || []).some(function (e) {
      if (e.id === eventId) { evRef = e; return true; }
      return false;
    });
  });

  if (!evRef) return Promise.reject(new Error('not found'));

  evRef.close_user_id = null;
  evRef.close_time = null;

  return fetch('/api/events/close', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Accept':'application/json'},
    body: JSON.stringify({ id: eventId, close_user_id: null, close_time: null })
  }).then(function (r) {
    if (!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  });
}

// Export small API into CalendarApp.ui if present (keeps your global style)
if (window.CalendarApp && window.CalendarApp.ui) {
  window.CalendarApp.ui.isEventClosed = isEventClosed;
  window.CalendarApp.ui.applyClosedStyles = applyClosedStyles;
  window.CalendarApp.ui.migrateEnsureCloseFields = migrateEnsureCloseFields;
  window.CalendarApp.ui.closeEventById = closeEventById;
  window.CalendarApp.ui.reopenEventById = reopenEventById;
}
