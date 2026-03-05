<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= isset($title) ? htmlspecialchars($title) : 'Планувальник' ?></title>

<?php
  // compute path and calendar flag (preserve your logic)
  $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
  $isCalendar = ($path === '/calendar' || $path === '/calendar/');
  $isAuthPage = in_array($path, ['/login', '/login/', '/register', '/register/'], true);

  $partialsDir = dirname(__DIR__) . '/layouts/partials';
  $headBase = $partialsDir . '/head.base.php';
  if (is_file($headBase)) { include $headBase; }
?>

</head>

<body>
  <?php
  // Load inline SVG sprite partial (kept inline for <use href="#id"> to work)
  $icons = $partialsDir . '/icons.php';
  if (is_file($icons)) { include $icons; }
  ?>

  <?php if (!$isAuthPage): ?>
  <!-- Hamburger menu toggle (top-left) -->
  <button id="sidebarToggle" class="ui-fab menu" type="button" title="Меню"
          aria-label="Меню" aria-controls="sidebar" aria-expanded="false">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M4 6h16M4 12h16M4 18h16"/>
    </svg>
  </button>

  <div id="sidebarOverlay" class="sidebar-overlay" data-sidebar-close aria-hidden="true"></div>


  <!-- Сайдбар -->
  <aside id="sidebar" class="sidebar" aria-hidden="true">
    <?php
    $side_menu =   dirname(__DIR__) . '/layouts/partials/menu.php';
     if (is_file($side_menu)) { include $side_menu; } 
    ?>
  </aside>
  <?php endif; ?>


  <!-- Page content -->
  <main class="page<?= $isCalendar ? ' calendar-page' : '' ?>">
    <?php if (!$isCalendar): ?>
      <div class="page-head"></div>
    <?php endif; ?>
    <section class="container">
      <?= $content ?? '' ?>
    </section>
  </main>

  <?php if (!empty($extra_js)): ?>
    <?php foreach ((array)$extra_js as $src):
      if (file_exists($_SERVER['DOCUMENT_ROOT'].$src)) { ?>
        <script src="<?= htmlspecialchars($src, ENT_QUOTES) ?>?v=<?= time() ?>" defer></script>
      <?php } else { ?>
        <script> console.log("<?= $_SERVER['DOCUMENT_ROOT'].$src?> not found"); </script>
      <?php } endforeach; ?>
  <?php endif; ?>

  <?php if (!$isAuthPage): ?>
  <script src="/assets/js/ui.sidebar.js" defer></script>
  <?php endif; ?>

  <!-- If you still need CSRF bootstrap, keep it inside <body> -->
  <script src="/assets/js/services/bootstrap.csrf.js" defer></script>

  <!-- P15.8: remember last main page for post-login redirect -->
  <script src="/assets/js/services/ui.last_start_page.js" defer></script>

  <!-- Optional: modules block (commented) -->
  <!--
  <?php if (!empty($modules_js)): ?>
    <?php foreach ((array)$modules_js as $src):
      if (file_exists($_SERVER['DOCUMENT_ROOT'].$src)) { ?>
        <script type="module" src="<?= htmlspecialchars($src, ENT_QUOTES) ?>?v=<?= time() ?>"></script>
      <?php } else { ?>
        <script> console.log("<?= $_SERVER['DOCUMENT_ROOT'].$src?> not found"); </script>
      <?php } endforeach; ?>
  <?php endif; ?>
  -->
<?php if (defined('APP_DEBUG') && APP_DEBUG) { console_log($_SESSION, '$_SESSION'); } ?>
<script src="/assets/js/services/api.users.js?v=1"></script>
</body>
</html>