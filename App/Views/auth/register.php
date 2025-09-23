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
</form>
</div>
