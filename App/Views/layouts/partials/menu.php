<?php
// English-only code
$isAuth = \App\Core\Auth::check();
?>
<nav class="menu">
  <a href="/">Планування</a>
  <a href="/calendar">Календар</a>
  <a href="/cabinet">Кабінет</a>
  <?php if ($isAuth): ?>
    <a href="/logout">Вийти</a>
  <?php else: ?>
    <a href="/login">Вхід</a>
  <?php endif; ?>
</nav>
