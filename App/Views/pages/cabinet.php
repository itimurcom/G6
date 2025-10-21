<?php
/** Resolve cabinet view user (by resolved CABINET_VIEW_USER_ID / GET / SESSION) */
$__viewId = defined('CABINET_VIEW_USER_ID')
    ? (int)CABINET_VIEW_USER_ID
    : (int)($_GET['user_id'] ?? ($_REQUEST['cabinet_user_id'] ?? ($_SESSION['user_id'] ?? 0)));

$u = null;
try { $u = (new \App\Models\UserFileRepository())->findById($__viewId); } catch (\Throwable $e) { $u = null; }
if (!$u) { $u = \App\Core\Auth::user() ?? []; }
$isOwnCabinet = ((int)($_SESSION['user_id'] ?? 0) === (int)($u['id'] ?? 0));
?>
<header class="cal-header">
<div class="title">Кабінет</div>
<nav class="cab-tabs"><button class="cab-tab is-active" data-tab="profile">Профіль</button><button class="cab-tab" data-tab="security">Безпека</button><button class="cab-tab" data-tab="users">Користувачі</button><button class="cab-tab" data-tab="journal">Журнал</button></nav>
<span class="user--name" data-user-id="<?= (int)($u['id'] ?? 0) ?>">loading…</span>
</header>
<div class="cabinet-wrap">
  <div class="cabinet-grid">
    <section class="cabinet-card" data-tab="profile">
      <h3>Профіль</h3>
        <table>
          <tr>
            <td class='space'><label>Ім’я</label><span></td>
            <td class='space'><?= htmlspecialchars($u['name'] ?? '') ?></td>
          </tr>
           <tr>
            <td class='space'><label>Ел. пошта</label></td>
            <td class='space'><?= htmlspecialchars($u['email'] ?? '') ?></td>
          </tr>    
        </table>
    </section>

    <section class="cabinet-card">
      <h3>Безпека</h3>
      <form method="post" action="/cabinet/password/change">
        <div class="field">
          <label>Поточний пароль</label>
          <input class="input" type="password" name="current_password" required>
        </div>
        <div class="field">
          <label>Новий пароль</label>
          <input class="input" type="password" name="new_password" minlength="8" required>
        </div>
        <div class="field">
          <label>Підтвердження нового пароля</label>
          <input class="input" type="password" name="confirm_password" minlength="8" required>
        </div>
        <input type="hidden" name="_csrf" value="<?= htmlspecialchars(\App\Security\Csrf::token(), ENT_QUOTES) ?>">
        <button class="btn btn--primary" type="submit">Змінити пароль</button>
      </form>
    </section>
<?php if (!empty($is_admin) && !empty($users) && is_array($users)): ?>
  <section class="cabinet-card" style="margin-top:24px">
    <h3>Користувачі</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;">Логін</th>
            <th style="text-align:left;padding:6px 8px;">Email</th>
            <th style="text-align:left;padding:6px 8px;">Тип</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($users as $row):
            $email = (string)($row['email'] ?? '');
            $login = (string)($row['login'] ?? ($row['username'] ?? ''));
            if ($login === '' || mb_strtolower($login) === mb_strtolower($email)) {
                $login = '—';
            }
            $role  = mb_strtolower((string)($row['role'] ?? ''));
            $isAdm = $role === 'admin' || !empty($row['is_admin']);
            $type  = $isAdm ? 'адмін' : 'користувач';
          ?>
            <tr>
              <td class='space'><?= htmlspecialchars($login, ENT_QUOTES) ?></td>
              <td class='space'><?= htmlspecialchars($email, ENT_QUOTES) ?></td>
              <td class='space'><?= $type ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </section>  
<?php endif; ?>

  </div>

    <!-- AUDIT: BEGIN Journal block (added by Patch #4) -->
    <section class="cabinet-card" id="audit-block" data-tab="journal">
      <h3>Журнал дій</h3>
      <header class="audit-toolbar">
        <div class="left">
          <strong>Journal</strong>
          <label><input type="radio" name="audit_scope" value="me" checked> Мої дії</label>
          <label class="admin-only"><input type="radio" name="audit_scope" value="all"> Всі дії</label>
        </div>
        <div class="right">
          <input id="audit-q" type="search" placeholder="Пошук (текст/користувач/поле)">
          <select id="audit-action">
            <option value="">Будь-яка дія</option>
            <option value="auth.login">Вхід</option>
            <option value="auth.logout">Вихід</option>
            <option value="event.create">Створення події</option>
            <option value="event.update">Зміна події</option>
            <option value="event.delete">Видалення події</option>
          </select>
          <select id="audit-limit"><option>20</option><option selected>50</option><option>100</option></select>
          <button id="audit-refresh" type="button">Оновити</button>
        </div>
      </header>
      <div id="audit-list" class="audit-list" data-is-admin="<?= !empty($is_admin) ? 1 : 0 ?>"></div>
      <footer class="audit-pager">
        <button id="audit-prev" type="button">◀ Новіші</button>
        <button id="audit-next" type="button">Старіші ▶</button>
      </footer>
    </section>
    <script>
    (function () {
      var elList = document.getElementById('audit-list');
      if (!elList) return;
      var isAdmin = String(elList.dataset.isAdmin) === '1';
      var scopeRadios = document.querySelectorAll('input[name="audit_scope"]');
      var q = document.getElementById('audit-q');
      var selAction = document.getElementById('audit-action');
      var selLimit = document.getElementById('audit-limit');
      var btnPrev = document.getElementById('audit-prev');
      var btnNext = document.getElementById('audit-next');
      var btnRefresh = document.getElementById('audit-refresh');
      var cursors = { next: null, prev: null };
      var offset = 0;
      function currentScope() {
        if (!isAdmin) return 'me';
        var r = Array.prototype.slice.call(scopeRadios).find(function (r) { return r.checked; });
        return r ? r.value : 'me';
      }
      function apiUrl(extra) {
        var base = '/api/audit/list';
        var p = new URLSearchParams();
        p.set('limit', selLimit.value || '50');
        p.set('scope', currentScope());
        if (q.value.trim()) p.set('q', q.value.trim());
        if (selAction.value) p.set('action', selAction.value);
        p.set('offset', String(extra && typeof extra.offset === 'number' ? extra.offset : offset));
        return base + '?' + p.toString();
      }
      function renderItem(it) {
        var li = document.createElement('div');
        li.className = 'audit-item ' + cssType(it);
        var tsIso = (it.ts || '').replace(' ', 'T').replace('Z','') + 'Z';
        var ts = new Date(tsIso);
        li.innerHTML =
          '<div class="head">' +
            '<span class="ts" title="' + (it.ts||'') + '">' + (isNaN(ts.getTime()) ? (it.ts||'') : ts.toLocaleString()) + '</span>' +
            '<span class="user">' + esc(it.user_name || '—') + '</span>' +
            '<span class="action">' + esc(it.action || '') + '</span>' +
            '<span class="result ' + (it.result||'') + '">' + (it.result||'') + '</span>' +
          '</div>' +
          '<div class="body">' +
            (it.message ? '<div class="msg">' + esc(it.message) + '</div>' : '') +
            (it.entity_type ? '<div class="entity">' + esc(it.entity_type) + '#' + esc(it.entity_id || '') + '</div>' : '') +
            (it.delta ? '<pre class="delta">' + esc(renderDelta(it.delta)) + '</pre>' : '') +
          '</div>';
        return li;
      }
      function cssType(it) {
        if (it.action === 'auth.login') return 't-login';
        if (it.action === 'auth.logout') return 't-logout';
        if (it.action === 'event.create') return 't-create';
        if (it.action === 'event.update') return 't-update';
        if (it.action === 'event.delete') return 't-delete';
        return 't-other';
      }
      function renderDelta(delta) {
        try { if (typeof delta === 'string') delta = JSON.parse(delta); } catch(e) {}
        if (!delta) return '';
        return Object.entries(delta || {}).map(function(kv){ return kv[0]+': '+kv[1]; }).join('\n');
      }
      function esc(s){ s=(s||'').toString(); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
      async function loadAt(newOffset, mode) {
        var url = apiUrl({ offset: newOffset });
        var r = await fetch(url);
        var j = await r.json();
        var frag = document.createDocumentFragment();
        (j.items||[]).forEach(function (it) { frag.appendChild(renderItem(it)); });
        if (mode === 'replace') { elList.innerHTML = ''; elList.appendChild(frag); }
        if (mode === 'append')  { elList.appendChild(frag); }
        if (mode === 'prepend') { elList.prepend(frag); }
        cursors.next = j.next; cursors.prev = j.prev;
        btnNext.disabled = !cursors.next; btnPrev.disabled = !cursors.prev;
        offset = newOffset;
      }
      async function loadInitial() { await loadAt(0, 'replace'); }
      async function loadNext()    { if (cursors.next)  await loadAt(cursors.next.offset,  'append'); }
      async function loadPrev()    { if (cursors.prev)  await loadAt(cursors.prev.offset,  'prepend'); }
      btnRefresh.addEventListener('click', loadInitial);
      btnNext.addEventListener('click', loadNext);
      btnPrev.addEventListener('click', loadPrev);
      [q, selAction, selLimit].forEach(function (el) { el.addEventListener('change', loadInitial); });
      Array.prototype.slice.call(scopeRadios).forEach(function (r) { r.addEventListener('change', loadInitial); });
      loadInitial();
    })();
    </script>
    <!-- AUDIT: END Journal block -->
    </div>


<script>
// Tabs controller — ADD ONLY
(function(){
  var tabs = document.querySelectorAll('.cab-tab');
  function setTab(name){
    tabs.forEach(function(t){ t.classList.toggle('is-active', t.dataset.tab===name); });
    var cards = document.querySelectorAll('.cabinet-card');
    cards.forEach(function(el){
      var tab = el.getAttribute('data-tab') || 'profile';
      el.style.display = (tab===name) ? '' : 'none';
    });
  }
  tabs.forEach(function(t){ t.addEventListener('click', function(){ setTab(t.dataset.tab); }); });
  setTab('profile');
})();
</script>
