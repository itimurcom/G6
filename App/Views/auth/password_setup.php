<?php
/** @var string $email */
?>
<div class="title">Встановити пароль</div>

<section class="card">
  <p>Акаунт: <strong><?= htmlspecialchars($email ?? '', ENT_QUOTES) ?></strong></p>

  <form method="post" action="/password/setup">
    <div class="field">
      <label>Новий пароль</label>
      <input class="input" type="password" name="new_password" minlength="8" required>
    </div>

    <div class="field">
      <label>Підтвердження нового пароля</label>
      <input class="input" type="password" name="confirm_password" minlength="8" required>
    </div>

    <input type="hidden" name="_csrf" value="<?= htmlspecialchars(\App\Security\Csrf::token(), ENT_QUOTES) ?>">
    <button class="btn btn--primary" type="submit">Зберегти пароль</button>
  </form>
</section>
