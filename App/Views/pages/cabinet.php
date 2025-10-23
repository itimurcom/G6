<?php
// Ensure $is_admin is available in the view
if (!isset($is_admin)) {
    try {
        $me = \App\Core\Auth::user();
        $role = mb_strtolower((string)($me['role'] ?? ''));
        $is_admin = (($me['is_admin'] ?? false) === true) || ((int)($me['is_admin'] ?? 0) === 1) || in_array($role, ['admin','superadmin','root'], true);
    } catch (\Throwable $___e) { $is_admin = false; }
}
?><?php
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
  <nav class="legend">
    <span class="lg is-active" data-tab="profile">Профіль</span>
    <span class="lg" data-tab="security">Безпека</span>
    <span class="lg" data-tab="users">Користувачі</span>
    <span class="lg" data-tab="journal">Журнал</span>
  </nav>
  <span class="user--name" data-user-id="<?= (int)($u['id'] ?? 0) ?>">loading…</span>
</header>

<div tabs="cabinet-wrap">
    
    <section class="cabinet-tab" data-tab="profile">
      <div class='sub-title'>Профіль</div>
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

    <section class="cabinet-tab" data-tab="security">
      <div class='sub-title'>Безпека</div>
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
  <section class="cabinet-tab" data-tab="users">
    <div class='sub-title'>Користувачі</div>
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


    <!-- AUDIT: BEGIN Journal block (added by Patch #4) -->
    <section class="cabinet-tab" id="audit-block" data-tab="journal">
      <div class='sub-title'>Журнал дій</div>
      <header class="audit-toolbar">
        <div class="left">
          <strong>Journal</strong>
          <label><input type="radio" name="audit_scope" value="me" checked> Мої дії</label>
          <label class="admin-only"><input type="radio" name="audit_scope" value="all"> Всі дії</label>
        </div>
        <div class="right">
          <input id="audit-q" type="search" class="input" placeholder="Пошук (текст/користувач/поле)">
          <select id="audit-action">
            <option value="">Будь-яка дія</option>
            <option value="auth.login">Вхід</option>
            <option value="auth.logout">Вихід</option>
            <option value="event.create">Створення події</option>
            <option value="event.update">Зміна події</option>
            <option value="event.delete">Видалення події</option>
          </select>
          <select id="audit-limit"><option>20</option><option selected>50</option><option>100</option></select>
          <button id="audit-refresh"  class='btn' type="button">Оновити</button>
        </div>
      </header>
      <div id="audit-list" class="audit-list" data-is-admin="<?= !empty($is_admin) ? 1 : 0 ?>"></div>
      <footer class="audit-pager">
        <button id="audit-prev" type="button" class='btn'>◀ Новіші</button>
        <button id="audit-next" type="button" class='btn'>Старіші ▶</button>
      </footer>
    </section>
    <!-- AUDIT: END Journal block -->
    </div>
