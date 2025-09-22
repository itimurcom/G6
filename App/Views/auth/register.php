<?php /** @var string $title */ ?>
<?php $err = \App\Core\Session::flash('error'); ?>
<div class="overlay" style="display:grid;place-items:center;z-index:50">
  <form class="modal" method="post" action="/register" aria-labelledby="regTitle" style="max-width:420px;width:92%;">
    <header>
      <div id="regTitle">Реєстрація</div>
      <button type="button" class="event-btn" aria-label="Закрити" onclick="location.href='/'">×</button>
    </header>
    <div class="content">
      <?php if ($err): ?>
        <div class="alert" style="background:#2b1b1b;border:1px solid #7f1d1d;color:#fecaca;padding:10px 12px;border-radius:10px;margin-bottom:10px;">
          <?= htmlspecialchars($err) ?>
        </div>
      <?php endif; ?>
      <label class="field">
        <div class="hint">Ім’я</div>
        <input type="text" name="name" required>
      </label>
      <label class="field">
        <div class="hint">Логін</div>
        <input type="text" name="login" required minlength="3">
      </label>
      <label class="field">
        <div class="hint">Пароль</div>
        <input type="password" name="password" required minlength="6">
      </label>
    </div>
    <footer>
      <span></span>
      <div style="display:flex;gap:10px;">
        <a class="btn" href="/login">У мене вже є акаунт</a>
        <button type="submit" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Створити</button>
      </div>
    </footer>
  </form>
</div>
