<?php /** @var string $title */ ?>
<?php $err = \App\Core\Session::flash('error'); ?>
<div class="auth-center">
  <form class="modal auth-modal" method="post" action="/register" aria-labelledby="regTitle">
    <header class="heading" style="padding:10px 14px;border-bottom:1px solid var(--border);">
      <div class="title" id="regTitle">Реєстрація</div>
    </header>
    <div class="content">
      <?php if ($err): ?>
        <div class="alert alert--error">
          <?= htmlspecialchars($err) ?>
        </div>
      <?php endif; ?>
      <label class="field">
        <div class="hint">Ім’я</div>
        <input class="input" type="text" name="name" required>
      </label>
      <label class="field">
        <div class="hint">Логін</div>
        <input class="input" type="text" name="login" required minlength="3">
      </label>
      <label class="field">
        <div class="hint">Пароль</div>
        <input class="input" type="password" name="password" required minlength="6">
      </label>
    </div>
    <footer>
      <span></span>
      <div class="actions">
        <a class="btn" href="/login">У мене вже є акаунт</a>
        <button type="submit" class="btn btn--primary">Створити</button>
      </div>
    </footer>
  <?php
<?php $cfg = @include dirname(__DIR__, 3) . '/config/auth.php';
$mode = $cfg['registration']['mode'] ?? 'invite';
$adminsExist = \App\Core\Auth::adminsExist();
?>
<div class="form-row">
  <label for="role"><strong>Role</strong></label>
  <select name="role" id="role">
    <option value="user">User</option>
    <option value="admin" <?php if ($mode === 'bootstrap' && $adminsExist) echo 'disabled'; ?>>Admin</option>
  </select>
</div>
<?php if ($mode === 'invite'): ?>
<div class="form-row">
  <label for="admin_code"><strong>Admin invite code</strong></label>
  <input type="text" id="admin_code" name="admin_code" placeholder="Enter admin invite code">
</div>
<?php endif; ?>

</form>
</div>
