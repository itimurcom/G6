<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= isset($title) ? htmlspecialchars($title) : 'Планувальник' ?></title>

  <!-- Base UI styles -->
  <script>
    (function () {
      try {
        var v = localStorage.getItem('ui-font-scale');
        if (v) document.documentElement.style.setProperty('--font-scale', v);
      } catch (e) { /* no-op */ }
    })();
  </script>
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

  <!-- G6 favicons (server default, JS will live-swap) -->
  <link id="g6-fav-16" rel="icon" type="image/png" sizes="16x16" href="/assets/favicon/light/favicon-16x16.png">
  <link id="g6-fav-32" rel="icon" type="image/png" sizes="32x32" href="/assets/favicon/light/favicon-32x32.png">

  <script>
    (function(){
      var MAP = {
        light: { f16: "/assets/favicon/light/favicon-16x16.png", f32: "/assets/favicon/light/favicon-32x32.png" },
        dark:  { f16: "/assets/favicon/dark/favicon-16x16.png",  f32: "/assets/favicon/dark/favicon-32x32.png"  }
      };
      function getTheme() {
        var de = document.documentElement;
        if (de.dataset && de.dataset.theme) return de.dataset.theme;
        if (de.classList && de.classList.contains('dark')) return 'dark';
        return 'light';
      }
      function g6FavApply(){
        var t = getTheme(), m = MAP[t] || MAP.light;
        var l16 = document.getElementById('g6-fav-16');
        var l32 = document.getElementById('g6-fav-32');
        if (l16) l16.href = m.f16;
        if (l32) l32.href = m.f32;
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', g6FavApply, {once:true});
      else g6FavApply();
      var mo = new MutationObserver(g6FavApply);
      mo.observe(document.documentElement, {attributes:true, attributeFilter:['class','data-theme']});
      window.addEventListener('themechange', g6FavApply);
      if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) mq.addEventListener('change', g6FavApply);
        else if (mq.addListener) mq.addListener(g6FavApply);
      }
      window.g6FavApply = g6FavApply;
    })();
  </script>

</head>

<body>
  <?php
  // Load inline SVG sprite partial (kept inline for <use href="#id"> to work)
  $viewsRoot   = dirname(__DIR__);          // App/Views
  $partialsDir = $viewsRoot . '/layouts/partials';
  $icons = $partialsDir . '/icons.php';
  if (is_file($icons)) { include $icons; }
  ?>

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

  <script src="/assets/js/ui.sidebar.js" defer></script>

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
<?php if (defined('APP_DEBUG') && APP_DEBUG) { console_log($_SESSION, '$_SESSION'); } ?>
<script src="/assets/js/services/api.users.js?v=1"></script>
</body>
</html>