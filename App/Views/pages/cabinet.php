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
$__cabinetInitials = static function (array $user): string {
    $src = trim((string)($user['name'] ?? ''));
    if ($src === '') {
        $src = trim((string)($user['login'] ?? ''));
    }
    if ($src === '') {
        return '??';
    }
    $parts = preg_split('/\s+/u', $src, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if (!$parts) {
        return '??';
    }
    $first = mb_substr((string)$parts[0], 0, 1);
    $second = '';
    if (count($parts) > 1) {
        $second = mb_substr((string)$parts[1], 0, 1);
    } else {
        $second = mb_substr((string)$parts[0], 1, 1);
    }
    $value = mb_strtoupper(trim($first . $second));
    return $value !== '' ? $value : '??';
};
$__cabAvatarInitials = $__cabinetInitials((array)$u);
$__cabHasAvatar = !empty($u['has_avatar']) && !empty($u['avatar_url']);
?>
<header class="cal-header">
  <!-- CABINET CARDS UI PATCH P15.5 -->
  <div class="title">Кабінет</div>
  <nav class="legend">
    <span class="lg is-active" data-tab="settings">Налаштування</span>
    <span class="lg" data-tab="security">Безпека</span>
    <?php if (!empty($is_admin)): ?>
    <span class="lg" data-tab="users">Користувачі</span>
    <?php endif; ?>
    <span class="lg" data-tab="journal">Журнал</span>
  </nav>
</header>

<div tabs="cabinet-wrap">


<?php
$flashError   = \App\Core\Session::flash('error');
$flashSuccess = \App\Core\Session::flash('success');

// P15.7: avoid duplicate password alerts; show password success as toast instead
$__hasPwWord = function ($s): bool {
  $s = (string)$s;
  if ($s == '') return false;
  if (function_exists('mb_stripos')) return (mb_stripos($s, 'парол') !== false);
  return (stripos($s, 'парол') !== false);
};

$__pwFlashErr = (!empty($flashError) && $__hasPwWord($flashError)) ? (string)$flashError : '';
$__pwFlashOk  = (!empty($flashSuccess) && $__hasPwWord($flashSuccess)) ? (string)$flashSuccess : '';

$__globalErr  = (!empty($flashError) && $__pwFlashErr === '') ? (string)$flashError : '';
$__globalOk   = (!empty($flashSuccess) && $__pwFlashOk === '') ? (string)$flashSuccess : '';
?>
<?php if ($__globalErr): ?>
  <div class="alert alert--error">
    <?= htmlspecialchars($__globalErr, ENT_QUOTES) ?>
  </div>
<?php endif; ?>
<?php if ($__globalOk): ?>
  <div class="alert alert--success">
    <?= htmlspecialchars($__globalOk, ENT_QUOTES) ?>
  </div>
<?php endif; ?>
<?php if ($__pwFlashOk): ?>
  <div id="cabinetToastPayload" data-kind="success" data-message="<?= htmlspecialchars($__pwFlashOk, ENT_QUOTES) ?>" hidden></div>
<?php endif; ?>
<?php
$__toastOk = \App\Core\Session::flash('toast_success');
$__toastErr = \App\Core\Session::flash('toast_error');
?>
<?php if (!empty($__toastOk)): ?>
  <div id="cabinetToastPayloadAdmin" data-kind="success" data-message="<?= htmlspecialchars((string)$__toastOk, ENT_QUOTES) ?>" hidden></div>
<?php endif; ?>
<?php if (!empty($__toastErr)): ?>
  <div id="cabinetToastPayloadAdminErr" data-kind="error" data-message="<?= htmlspecialchars((string)$__toastErr, ENT_QUOTES) ?>" hidden></div>
<?php endif; ?>

    <section class="cabinet-tab" data-tab="settings">
      <div class='sub-title'>Налаштування</div>

      <div class="cabinet-settings">
        <div class="cab-card">
          <div class="cab-card__title">Профіль</div>
          <div class="cab-card__body">
            <div class="cab-profile-head">
              <?php if ($isOwnCabinet): ?>
              <form method="post" action="/cabinet/avatar/upload" enctype="multipart/form-data" id="cabAvatarUploadForm" class="cab-avatar-form">
                <input type="hidden" name="_csrf" value="<?= htmlspecialchars(\App\Security\Csrf::token(), ENT_QUOTES) ?>">
                <input class="cab-avatar-input" type="file" id="cabAvatarInput" name="avatar_file" accept="image/jpeg,image/png,image/webp">
                <button type="button" class="cab-avatar-preview cab-avatar-trigger <?= $__cabHasAvatar ? 'has-image' : '' ?>" id="cabAvatarPreview" data-initials="<?= htmlspecialchars($__cabAvatarInitials, ENT_QUOTES) ?>" aria-label="Змінити аватарку" title="Натисни, щоб вибрати аватарку">
                  <?php if ($__cabHasAvatar): ?>
                    <img src="<?= htmlspecialchars((string)$u['avatar_url'], ENT_QUOTES) ?>" alt="Аватар користувача" id="cabAvatarImg">
                  <?php endif; ?>
                  <span id="cabAvatarInitials"<?= $__cabHasAvatar ? ' hidden' : '' ?>><?= htmlspecialchars($__cabAvatarInitials, ENT_QUOTES) ?></span>
                </button>
              </form>
              <?php if ($__cabHasAvatar): ?>
              <form method="post" action="/cabinet/avatar/delete" class="cab-avatar-delete-form" id="cabAvatarDeleteForm">
                <input type="hidden" name="_csrf" value="<?= htmlspecialchars(\App\Security\Csrf::token(), ENT_QUOTES) ?>">
                <button type="submit" class="cab-avatar-delete" id="cabAvatarDeleteBtn" aria-label="Видалити аватарку" title="Видалити аватарку">×</button>
              </form>
              <?php endif; ?>
              <?php else: ?>
              <div class="cab-avatar-preview <?= $__cabHasAvatar ? 'has-image' : '' ?>">
                <?php if ($__cabHasAvatar): ?>
                  <img src="<?= htmlspecialchars((string)$u['avatar_url'], ENT_QUOTES) ?>" alt="Аватар користувача">
                <?php endif; ?>
                <span<?= $__cabHasAvatar ? ' hidden' : '' ?>><?= htmlspecialchars($__cabAvatarInitials, ENT_QUOTES) ?></span>
              </div>
              <?php endif; ?>

              <div class="cab-profile-meta">
                <div class="cab-kv cab-kv--profile">
                  <div class="cab-kv__k">Логін</div>
                  <div class="cab-kv__v"><?= htmlspecialchars((string)($u['login'] ?? ''), ENT_QUOTES) ?></div>

                  <div class="cab-kv__k">Ім’я</div>
                  <div class="cab-kv__v"><?= htmlspecialchars((string)($u['name'] ?? ''), ENT_QUOTES) ?></div>

                  <div class="cab-kv__k">Ел. пошта</div>
                  <div class="cab-kv__v"><?= htmlspecialchars((string)($u['email'] ?? ''), ENT_QUOTES) ?></div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
          <div class="cab-card__title">Шрифт</div>
          <div class="cab-card__body">
            <div class="ui-seg ui-seg--font" role="group" aria-label="Шрифт інтерфейсу">
              <button type="button" class="ui-seg__btn" data-font-family="inter" title="Inter (локально)">
                <span class="ui-font-chip ui-font-chip--inter" aria-hidden="true">Aa</span>
                <span>Inter</span>
              </button>
              <button type="button" class="ui-seg__btn" data-font-family="sfpro" title="SF Pro (локально)">
                <span class="ui-font-chip ui-font-chip--sfpro" aria-hidden="true">Aa</span>
                <span>SF Pro</span>
              </button>
              <button type="button" class="ui-seg__btn" data-font-family="arial" title="Arial (системний)">
                <span class="ui-font-chip ui-font-chip--arial" aria-hidden="true">Aa</span>
                <span>Arial</span>
              </button>
            </div>
            <div class="hint">Перемикає базовий шрифт інтерфейсу. Зберігається в браузері (Local Storage).</div>
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

<?php if (!empty($is_admin)): ?>
        <div class="cab-card">
          <div class="cab-card__title">Максимальний розмір файла</div>
          <div class="cab-card__body">
            <?php
              $__uploadMaxMb = 100;
              try {
                $__uploadMaxMb = (new \App\Models\AppSettingMysqlRepository())->getInt('upload.max_file_mb', 100);
              } catch (\Throwable $e) {
                $__uploadMaxMb = 100;
              }
              $__uploadMaxMb = max(1, min(1024, (int)$__uploadMaxMb));
            ?>
            <div class="field">
              <label for="uiMaxFileMb">Максимум (MB)</label>
              <div class="row" style="display:flex; gap:10px; align-items:center;">
                <input id="uiMaxFileMb" class="input" type="number" min="1" max="1024" step="1" value="<?= (int)$__uploadMaxMb ?>" style="width:50%; min-width:220px;" />
                <button id="uiMaxFileMbSave" type="button" class="btn btn--primary" disabled aria-label="Зберегти" title="Зберегти" style="padding:10px 14px; min-width:48px; display:flex; align-items:center; justify-content:center;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="display:block;">
                    <use href="#i-floppy-save"></use>
                  </svg>
                </button>
              </div>
              <span id="uiMaxFileMbStatus" class="hint" style="margin:8px 0 0 0; display:inline-block;">Завантаження…</span>
            </div>
            <div class="hint">Застосовується до завантаження файлів у коментарях. Глобальне налаштування для всього проекту (зберігається на сервері). За замовчуванням: 100 MB.</div>
          </div>
        </div>
<?php endif; ?>
      </div>
    </section>

    <section class="cabinet-tab" data-tab="security">
      <div class='sub-title'>Безпека</div>

      <div class="cabinet-settings">
        <div class="cab-card">
          <div class="cab-card__title">Зміна пароля</div>
          <div class="cab-card__body">
            <?php
  // P15.7: password errors are shown inline; password success is shown as toast (see cabinetToastPayload)
?>
<?php if (!empty($__pwFlashErr)): ?>
  <div class="alert alert--error cab-alert-inline">
    <?= htmlspecialchars($__pwFlashErr, ENT_QUOTES) ?>
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
          <table class="cab-table" id="adminUsersTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Логін</th>
                <th>Імʼя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Адмін</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($users as $row):
            $id    = (int)($row['id'] ?? 0);
            $email = (string)($row['email'] ?? '');
            $login = (string)($row['login'] ?? ($row['username'] ?? ''));
            $name  = (string)($row['name'] ?? '');
            $role  = (string)($row['role'] ?? 'user');
            $isAdm = !empty($row['is_admin']) || mb_strtolower($role) === 'admin' || mb_strtolower($role) === 'superadmin' || mb_strtolower($role) === 'root';
            $created = (string)($row['created_at'] ?? '');
            $updated = (string)($row['updated_at'] ?? '');

            $userJson = htmlspecialchars(json_encode([
                'id' => $id,
                'login' => $login,
                'name' => $name,
                'email' => $email,
                'role' => $role,
                'is_admin' => $isAdm ? 1 : 0,
                'created_at' => $created,
                'updated_at' => $updated,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ENT_QUOTES);
          ?>
            <tr>
              <td class='space'><?= (int)$id ?></td>
              <td class='space'><?= htmlspecialchars($login, ENT_QUOTES) ?></td>
              <td class='space'><?= htmlspecialchars($name, ENT_QUOTES) ?></td>
              <td class='space'><?= htmlspecialchars($email ?: '—', ENT_QUOTES) ?></td>
              <td class='space'><?= htmlspecialchars($role ?: 'user', ENT_QUOTES) ?></td>
              <td class='space'><?= $isAdm ? 'так' : 'ні' ?></td>
              <td class='space' style='text-align:right'>
                <a href="#" class="cab-action-link js-user-edit" data-user="<?= $userJson ?>">Редагувати</a>
                <span class="cab-action-sep">•</span>
                <a href="#" class="cab-action-link js-user-pass" data-user="<?= $userJson ?>">Пароль</a>
              </td>
            </tr>
          <?php endforeach; ?>
            </tbody>
          </table>

          <div class="cab-modal" id="adminUserModal" hidden>
            <div class="cab-modal__backdrop" data-close="1"></div>
            <div class="cab-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="adminUserModalTitle">
              <div class="cab-modal__head">
                <div class="cab-modal__title" id="adminUserModalTitle">Редагування користувача</div>
                <button type="button" class="cab-modal__close" data-close="1" aria-label="Закрити">✕</button>
              </div>
              <div class="cab-modal__body">
                <form class="cab-form" method="post" action="/cabinet/users/update" autocomplete="off">
                  <input type="hidden" name="user_id" id="adminUserId" value="">
                  <input type="hidden" name="_csrf" value="<?= htmlspecialchars(\App\Security\Csrf::token(), ENT_QUOTES) ?>">

                                    <!-- P15.14: meta (ID/created/updated) is display-only, not form fields -->
                  <div class="cab-modal__meta" aria-label="Довідкова інформація">
                    <span class="cab-modal__metaItem"><span class="k">ID:</span> <span class="v" id="adminUserIdView">—</span></span>
                    <span class="cab-modal__metaItem"><span class="k">Створено:</span> <span class="v" id="adminUserCreated">—</span></span>
                    <span class="cab-modal__metaItem"><span class="k">Оновлено:</span> <span class="v" id="adminUserUpdated">—</span></span>
                  </div>

                  <div class="field">
                    <label>Роль</label>
                    <select class="input" name="role" id="adminUserRole">
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="superadmin">superadmin</option>
                        <option value="root">root</option>
                    </select>
                  </div>

                  <div class="field">
                    <label>Імʼя</label>
                    <input class="input" type="text" name="name" id="adminUserName" required>
                  </div>

                  <div class="cab-grid2">
                    <div class="field">
                      <label>Логін</label>
                      <input class="input" type="text" name="login" id="adminUserLogin" required>
                    </div>
                    <div class="field">
                      <label>Email</label>
                      <input class="input" type="email" name="email" id="adminUserEmail" placeholder="(необовʼязково)">
                    </div>
                  </div>

                  <div class="field">
                    <label class="ui-switch">
                      <input type="checkbox" name="is_admin" id="adminUserIsAdmin" value="1">
                      <span class="ui-switch__track" aria-hidden="true"></span>
                      <span class="ui-switch__label">Прапор is_admin</span>
                    </label>
                    <div class="hint">Право адміна визначається ролью (admin/superadmin/root) або прапором is_admin.</div>
                  </div>

                  <div class="cab-divider"></div>

                  <div class="cab-modal__actions">
                    <button class="btn" type="button" data-close="1">Скасувати</button>
                    <button class="btn btn--primary" type="submit">Зберегти</button>
                  </div>
                </form>
              </div>
            </div>

          </div>


          <div class="cab-modal" id="adminUserPassModal" hidden>
            <div class="cab-modal__backdrop" data-close="1"></div>
            <div class="cab-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="adminUserPassModalTitle">
              <div class="cab-modal__head">
                <div class="cab-modal__title" id="adminUserPassModalTitle">Зміна пароля</div>
                <button type="button" class="cab-modal__close" data-close="1" aria-label="Закрити">✕</button>
              </div>
              <div class="cab-modal__body">
                <form class="cab-form" method="post" action="/cabinet/users/password" autocomplete="off">
                  <input type="hidden" name="user_id" id="adminUserPassId" value="">
                  <input type="hidden" name="_csrf" value="<?= htmlspecialchars(\App\Security\Csrf::token(), ENT_QUOTES) ?>">

                  <div class="cab-modal__meta" aria-label="Довідкова інформація">
                    <span class="cab-modal__metaItem"><span class="k">Користувач:</span> <span class="v" id="adminUserPassUser">—</span></span>
                  </div>

                  <div class="field">
                    <label>Новий пароль</label>
                    <input class="input" type="password" name="new_password" id="adminUserPassNew" minlength="8" required autocomplete="new-password">
                    <div class="hint">Мінімум 8 символів. Пароль буде змінено одразу після збереження.</div>
                  </div>

                  <div class="cab-modal__actions">
                    <button class="btn" type="button" data-close="1">Скасувати</button>
                    <button class="btn btn--primary" type="submit">Змінити пароль</button>
                  </div>
                </form>
              </div>
            </div>
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
            <option value="calendar.event.assignee_change">Зміна виконавця (на виконанні)</option>
            <option value="calendar.event.accept">Прийнято подію на виконання</option>
            <option value="calendar.event.delete">Видалення події</option>
            <option value="event.message.create">Додано коментар</option>
            <option value="event.message.update">Змінено коментар</option>
            <option value="event.message.delete">Видалено коментар</option>
            <option value="document.upload">Завантажено файл</option>
            <option value="document.delete">Видалено файл</option>
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
