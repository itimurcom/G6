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

$menuUser = null;
$menuUserName = '';
$menuUserLogin = '';
$menuUserAvatarUrl = '';
$menuUserHasAvatar = false;
$menuUserInitials = 'U';

if ($isAuth) {
    try {
        $menuUser = \App\Core\Auth::user();
    } catch (\Throwable $__) {
        $menuUser = null;
    }

    $menuUserName = trim((string)($menuUser['name'] ?? ($_SESSION['user']['name'] ?? '')));
    $menuUserLogin = trim((string)($menuUser['login'] ?? ($_SESSION['user']['login'] ?? '')));
    if ($menuUserName === '') {
        $menuUserName = $menuUserLogin !== '' ? $menuUserLogin : 'Користувач';
    }

    $menuUserHasAvatar = !empty($menuUser['has_avatar']);
    $avatarVersion = trim((string)($menuUser['avatar_version'] ?? ''));
    $menuUserId = (int)($menuUser['id'] ?? ($_SESSION['user']['id'] ?? 0));
    if ($menuUserHasAvatar && $menuUserId > 0) {
        $menuUserAvatarUrl = '/api/users/avatar?id=' . $menuUserId . ($avatarVersion !== '' ? ('&v=' . rawurlencode($avatarVersion)) : '');
    }

    $parts = preg_split('/\s+/u', trim($menuUserName)) ?: [];
    $letters = [];
    foreach ($parts as $part) {
        $part = trim((string)$part);
        if ($part === '') continue;
        $letters[] = mb_strtoupper(mb_substr($part, 0, 1, 'UTF-8'), 'UTF-8');
        if (count($letters) >= 2) break;
    }
    if (!$letters && $menuUserLogin !== '') {
        $letters[] = mb_strtoupper(mb_substr($menuUserLogin, 0, 1, 'UTF-8'), 'UTF-8');
    }
    $menuUserInitials = implode('', $letters) ?: 'U';
}
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

  <?php if ($isAuth): ?>
    <a class="sidebar-user" href="/cabinet" aria-label="Відкрити кабінет користувача">
      <span class="sidebar-user__avatar<?= $menuUserHasAvatar ? ' has-image' : '' ?>">
        <?php if ($menuUserHasAvatar && $menuUserAvatarUrl !== ''): ?>
          <img src="<?= htmlspecialchars($menuUserAvatarUrl, ENT_QUOTES) ?>" alt="Аватар користувача">
        <?php else: ?>
          <span><?= htmlspecialchars($menuUserInitials, ENT_QUOTES) ?></span>
        <?php endif; ?>
      </span>
      <span class="sidebar-user__meta">
        <span class="sidebar-user__name"><?= htmlspecialchars($menuUserName, ENT_QUOTES) ?></span>
        <span class="sidebar-user__login"><?= htmlspecialchars($menuUserLogin !== '' ? ('@' . $menuUserLogin) : '@user', ENT_QUOTES) ?></span>
      </span>
    </a>
  <?php endif; ?>

  <nav class="sidebar-menu" aria-label="Навігація">
    <a class="sidebar-link<?= $mk('/') ?>" href="/">Планування</a>
    <a class="sidebar-link<?= $mk('/calendar') ?>" href="/calendar">Календар</a>
    <a class="sidebar-link<?= ($path === '/cabinet' && $queryTab === 'settings') ? ' is-active' : '' ?>" href="/cabinet?tab=settings">Налаштування</a>
    <?php if ($isAuth): ?>
      <a class="sidebar-link danger" href="/logout">Вийти</a>
    <?php else: ?>
      <a class="sidebar-link<?= $mk('/login') ?>" href="/login">Вхід</a>
    <?php endif; ?>
  </nav>
</div>
