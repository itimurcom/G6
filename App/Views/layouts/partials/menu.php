<?php
// English-only code
$isAuth = \App\Core\Auth::check();
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$queryTab = strtolower((string)($_GET['tab'] ?? ''));

$mk = static function(string $href) use ($path): string {
    // simple active marker
    if ($href === '/') {
        return ($path === '/' || $path === '') ? ' is-active' : '';
    }
    return (strpos($path, $href) === 0) ? ' is-active' : '';
};
?>
<div class="sidebar-panel" role="dialog" aria-label="Меню">
  <div class="sidebar-head">
    <div class="sidebar-title">Меню</div>
    <button type="button" class="sidebar-close" data-sidebar-close aria-label="Закрити меню" title="Закрити">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <use href="#i-x"></use>
      </svg>
    </button>
  </div>

  <nav class="sidebar-menu" aria-label="Навігація">
    <a class="sidebar-link<?= $mk('/') ?>" href="/">Планування</a>
    <a class="sidebar-link<?= $mk('/calendar') ?>" href="/calendar">Календар</a>
    <a class="sidebar-link<?= ($path === '/cabinet' && $queryTab !== 'settings') ? ' is-active' : '' ?>" href="/cabinet">Кабінет</a>
    <a class="sidebar-link<?= ($path === '/cabinet' && $queryTab === 'settings') ? ' is-active' : '' ?>" href="/cabinet?tab=settings">Налаштування</a>
    <?php if ($isAuth): ?>
      <a class="sidebar-link danger" href="/logout">Вийти</a>
    <?php else: ?>
      <a class="sidebar-link<?= $mk('/login') ?>" href="/login">Вхід</a>
    <?php endif; ?>
  </nav>
</div>
