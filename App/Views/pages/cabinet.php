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
try { $u = (new \App\Models\UserMysqlRepository())->findById($__viewId); } catch (\Throwable $e) { $u = null; }
if (!$u) { $u = \App\Core\Auth::user() ?? []; }
$isOwnCabinet = ((int)($_SESSION['user_id'] ?? 0) === (int)($u['id'] ?? 0));
?>
<header class="cal-header">
  <!-- CABINET CARDS UI PATCH P15.5 -->
  <div class="title">Кабінет</div>
  <nav class="legend">
    <span class="lg is-active" data-tab="profile">Профіль</span>
    <span class="lg" data-tab="security">Безпека</span>
    <span class="lg" data-tab="settings">Налаштування</span>
    <?php if (!empty($is_admin)): ?>
    <span class="lg" data-tab="users">Користувачі</span>
    <?php endif; ?>
    <span class="lg" data-tab="journal">Журнал</span>
  </nav>
  <span class="user--name" data-user-id="<?= (int)($u['id'] ?? 0) ?>">loading…</span>
</header>

<div tabs="cabinet-wrap">

<?php
$flashError   = \App\Core\Session::flash('error');
$flashSuccess = \App\Core\Session::flash('success');
if ($flashError): ?>
  <div class="alert alert--error">
    <?= htmlspecialchars($flashError, ENT_QUOTES) ?>
  </div>
<?php endif; ?>
<?php if ($flashSuccess): ?>
  <div class="alert alert--success">
    <?= htmlspecialchars($flashSuccess, ENT_QUOTES) ?>
  </div>
<?php endif; ?>

    <section class="cabinet-tab" data-tab="profile">
      <div class='sub-title'>Профіль</div>

      <div class="cabinet-settings">
        <div class="cab-card">
          <div class="cab-card__title">Основне</div>
          <div class="cab-card__body">
            <div class="cab-kv">
              <div class="cab-kv__k">Ім’я</div>
              <div class="cab-kv__v"><?= htmlspecialchars($u['name'] ?? '', ENT_QUOTES) ?></div>

              <div class="cab-kv__k">Ел. пошта</div>
              <div class="cab-kv__v"><?= htmlspecialchars($u['email'] ?? '', ENT_QUOTES) ?></div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="cabinet-tab" data-tab="settings" style="display:none">
      <div class='sub-title'>Налаштування</div>

      <div class="cabinet-settings">
        <div class="cab-card">
          <div class="cab-card__title">Тема</div>
          <div class="cab-card__body">
            <label class="ui-switch">
              <input id="uiThemeToggle" type="checkbox" />
              <span class="ui-switch__track" aria-hidden="true"></span>
              <span class="ui-switch__label">Темна тема</span>
            </label>
            <div class="hint">Перемикає світлу/темну тему. Налаштування зберігається в браузері.</div>
          </div>
        </div>

        <div class="cab-card">
          <div class="cab-card__title">Розмір шрифта</div>
          <div class="cab-card__body">
            <div class="ui-seg" role="group" aria-label="Розмір шрифта">
              <button type="button" class="ui-seg__btn" data-font-scale="0.75">75%</button>
              <button type="button" class="ui-seg__btn" data-font-scale="1">100%</button>
              <button type="button" class="ui-seg__btn" data-font-scale="1.25">125%</button>
              <button type="button" class="ui-seg__btn" data-font-scale="1.5">150%</button>
            </div>
            <div class="hint">Застосовується до всього інтерфейсу. Налаштування зберігається в браузері.</div>
          </div>
        </div>
      </div>
    </section>


    <section class="cabinet-tab" data-tab="security">
      <div class='sub-title'>Безпека</div>

      <div class="cabinet-settings">
        <div class="cab-card">
          <div class="cab-card__title">Зміна пароля</div>
          <div class="cab-card__body">
            <?php
              // P15.6: show password-related flash messages inline (near the password form)
              $__hasPwWord = function ($s): bool {
                $s = (string)$s;
                if ($s === '') return false;
                if (function_exists('mb_stripos')) return (mb_stripos($s, 'парол') !== false);
                return (stripos($s, 'парол') !== false);
              };
              $__pwFlashErr = (!empty($flashError) && $__hasPwWord($flashError)) ? (string)$flashError : '';
              $__pwFlashOk  = (!empty($flashSuccess) && $__hasPwWord($flashSuccess)) ? (string)$flashSuccess : '';
            ?>
            <?php if ($__pwFlashErr): ?>
              <div class="alert alert--error cab-alert-inline">
                <?= htmlspecialchars($__pwFlashErr, ENT_QUOTES) ?>
              </div>
            <?php endif; ?>
            <?php if ($__pwFlashOk): ?>
              <div class="alert alert--success cab-alert-inline">
                <?= htmlspecialchars($__pwFlashOk, ENT_QUOTES) ?>
              </div>
            <?php endif; ?>
            <form class="cab-form" method="post" action="/cabinet/password/change">
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
              <div class="hint">Мінімальна довжина пароля — 8 символів.</div>
            </form>
          </div>
        </div>
      </div>
    </section>

<?php if (!empty($is_admin) && !empty($users) && is_array($users)): ?>
  <section class="cabinet-tab" data-tab="users">
    <div class='sub-title'>Користувачі</div>

    <div class="cabinet-settings">
      <div class="cab-card">
        <div class="cab-card__title">Список користувачів</div>
        <div class="cab-card__body">
          <table class="cab-table">
            <thead>
              <tr>
                <th>Логін</th>
                <th>Email</th>
                <th>Тип</th>
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
      </div>
    </div>
  </section>    
<?php endif; ?>


    <section class="cabinet-tab" id="audit-block" data-tab="journal">
      <div class='sub-title'>Журнал дій</div>
      <header class="audit-toolbar">
          <label class="admin-only"><input type="radio" name="audit_scope" value="all">Дії всіх користувачів</label>
          <label><input type="radio" name="audit_scope" value="me" checked> Мої дії</label>
          <input id="audit-q" type="search" class="input" placeholder="Пошук (текст/користувач/поле)">
          <select id="audit-action">
            <option value="">Будь-яка дія</option>
            <option value="auth.login">Вхід</option>
            <option value="auth.logout">Вихід</option>
            <option value="calendar.event.create">Створення події</option>
            <option value="calendar.event.update">Зміна події</option>
            <option value="calendar.event.delete">Видалення події</option>
          </select>
          <select id="audit-limit"><option>20</option><option selected>50</option><option>100</option></select>
          <button id="audit-refresh"  class='btn' type="button">Оновити</button>
      </header>
      <div id="audit-list" class="audit-list" data-is-admin="<?= !empty($is_admin) ? 1 : 0 ?>"></div>
      <footer class="audit-pager">
        <button id="audit-prev" type="button" class='btn'>◀ Новіші</button>
        <button id="audit-next" type="button" class='btn'>Старіші ▶</button>
      </footer>
    </section>
    </div>
