<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= isset($title) ? htmlspecialchars($title) : 'Планувальник' ?></title>

  <!-- Base UI styles -->
  <link rel="stylesheet" href="/assets/css/style.css">
  <?php
    // compute path and calendar flag (preserve your logic)
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $isCalendar = ($path === '/calendar' || $path === '/calendar/');
  ?>

  <?php if (!empty($extra_css)): ?>
    <?php foreach ((array)$extra_css as $href):
      if (file_exists($_SERVER['DOCUMENT_ROOT'].$href)) { ?>
        <link rel="stylesheet" href="<?= htmlspecialchars($href) ?>?v=<?= htmlspecialchars($ver ?? time()) ?>">
      <?php } else { ?>
        <script> console.log("<?= $_SERVER['DOCUMENT_ROOT'].$href?> not found"); </script>
      <?php } endforeach; ?>
  <?php endif; ?>
</head>

<body>
  <?php
  // Load inline SVG sprite partial (kept inline for <use href="#id"> to work)
  $viewsRoot   = dirname(__DIR__);          // App/Views
  $partialsDir = $viewsRoot . '/layouts/partials';
  $icons = $partialsDir . '/icons.php';
  if (is_file($icons)) { include $icons; }
  ?>

  <!-- Сайдбар -->
  <aside id="sidebar" class="sidebar">
    <?php
    $side_menu =   dirname(__DIR__) . '/layouts/partials/menu.php';
     if (is_file($side_menu)) { include $side_menu; } 
    ?>
  </aside>

  <!-- Page content -->
  <main class="page<?= $isCalendar ? ' calendar-page' : '' ?>">
    <?php if (!$isCalendar): ?>
      <div class="page-head"></div>
    <?php endif; ?>
    <section class="container">
      <?= $content ?? '' ?>
    </section>
  </main>

  <!-- App scripts -->
  <script src="/assets/js/app.js" defer></script>

  <?php if (!empty($extra_js)): ?>
    <?php foreach ((array)$extra_js as $src):
      if (file_exists($_SERVER['DOCUMENT_ROOT'].$src)) { ?>
        <script src="<?= htmlspecialchars($src, ENT_QUOTES) ?>?v=<?= time() ?>" defer></script>
      <?php } else { ?>
        <script> console.log("<?= $_SERVER['DOCUMENT_ROOT'].$src?> not found"); </script>
      <?php } endforeach; ?>
  <?php endif; ?>

  <!-- If you still need CSRF bootstrap, keep it inside <body> -->
  <script src="/assets/js/services/bootstrap.csrf.js" defer></script>

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
<? console_log($_SESSION, '$_SESSION'); ?>
<script src="/assets/js/services/api.users.js?v=1"></script>
</body>
</html>