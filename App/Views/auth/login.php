<?php /** @var string $title */ ?>
<?php $err = \App\Core\Session::flash('error'); ?>
<div class="auth-center">
  <form class="modal auth-modal" method="post" action="/login" aria-labelledby="authTitle">
    <header class="heading" style="padding:10px 14px;border-bottom:1px solid var(--border);">
      <div class="title" id="authTitle">Вхід</div>
    </header>
    <div class="content">
      <?php if ($err): ?>
        <div class="alert alert--error">
          <?= htmlspecialchars($err) ?>
        </div>
      <?php endif; ?>
      <label class="field">
        <div class="hint">Логін</div>
        <input class="input" type="text" name="login" required autofocus>
      </label>
      <label class="field">
        <div class="hint">Пароль</div>
        <input class="input" type="password" name="password" required minlength="6">
      </label>
    </div>
    <footer>
      <span></span>
      <div class="actions">
        <a class="btn" href="/register">Реєстрація</a>
        <button type="submit" class="btn btn--primary">Увійти</button>
      </div>
    </footer>
  <input type="hidden" name="_csrf" value="<?= htmlspecialchars(\App\Security\Csrf::token(), ENT_QUOTES) ?>">
</form>
</div>
