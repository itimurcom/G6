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
<span class="user--name" data-user-id="<?= (int)($u['id'] ?? 0) ?>">loading…</span>
</header>
<div class="cabinet-wrap">
  <div class="cabinet-grid">
    <section class="cabinet-card">
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
</div>
