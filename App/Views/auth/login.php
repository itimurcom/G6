<?php /** @var string $title */ ?>
<section class="auth">
  <h1><?= htmlspecialchars($title ?? 'Sign In') ?></h1>
  <?php $err = \App\Core\Session::flash('error'); if ($err): ?>
    <div class="auth-error"><?= htmlspecialchars($err) ?></div>
  <?php endif; ?>
  <form method="post" action="/login">
    <label>Email<input type="email" name="email" required></label>
    <label>Password<input type="password" name="password" required minlength="6"></label>
    <button type="submit">Sign In</button>
  </form>
  <p><a href="/register">Create an account</a></p>
</section>
