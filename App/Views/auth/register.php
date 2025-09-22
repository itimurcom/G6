<?php /** @var string $title */ ?>
<section class="auth">
  <h1><?= htmlspecialchars($title ?? 'Sign Up') ?></h1>
  <?php $err = \App\Core\Session::flash('error'); if ($err): ?>
    <div class="auth-error"><?= htmlspecialchars($err) ?></div>
  <?php endif; ?>
  <form method="post" action="/register">
    <label>Name<input type="text" name="name" required></label>
    <label>Email<input type="email" name="email" required></label>
    <label>Password<input type="password" name="password" required minlength="6"></label>
    <button type="submit">Sign Up</button>
  </form>
  <p><a href="/login">Already have an account? Sign in</a></p>
</section>
